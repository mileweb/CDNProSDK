const fs = require('fs');
const {buildAuth, callServer, cdnpro} = require('./cdnpro-helper');
const { cred } = require('./SECRET_credentials');

//Usage: node getDplyCid.js now 7d
var endDate = (process.argv[2]||'now').toLowerCase();
var reportSpan = process.argv[3]||'7d';

var timeRange = cdnpro.reqTimeRange({end: endDate, span: reportSpan});
console.log('Report time range:', timeRange);
//process.exit(0);

function assertEqual(v1, v2) {
    if (v1 != v2) {
        console.error('ERROR in assertEqual():', v1, 'is not equal to', v2);
        process.exit(1);
    }
}

function getNgDeploy(offset) {
    let ngOptions = buildAuth(cred.cdnPro);
    ngOptions.path = `/cdn/deploymentTasks?${timeRange}&offset=${offset}&limit=200&target=production`;
    ngOptions.headers['Report-Range']='self+children';
    ngOptions.method = 'GET';
    ngOptions.headers['Content-Type']='application/json; charset=UTF-8';
    ngOptions.offset = offset;
    callServer(ngOptions, procNgDeploy);
}

let deploysByCid = {};

function procNgDeploy(jsonData, ctx) {
//    console.log(jsonData);
/*
{
  "count": 428,
  "deploy": [
    {
      "id": "6b38692f-a126-4b66-b6cd-a0472d786c9f",
      "name": "DeploymentName_1652762929340",
      "submissionTime": "2022-05-17T04:49:18Z",
      "status": "inprogress",
      "target": "production",
      "customerId": 330,
      "apiRequestId": "17e4d2a6ad948eca"
    },
    ...
*/
    let n = jsonData.deploy.length;
    let offset = ctx.options.offset + n;
    for (let x of jsonData.deploy) {
        let cid = x.customerId;
        let n = deploysByCid[cid] || 0;
        deploysByCid[cid] = n + 1;
    }
    if (offset < jsonData.count) getNgDeploy(offset);
    else {
        // convert object to array
        let deploys = [];
        for (let cid in deploysByCid) {
            deploys.push(cid);
        }
        cdnpro.setServerInfo(cred.cdnPro);
        cdnpro.listCustomers({ids:deploys}).then(customers => {
            for (let c of customers.customers) {
                deploysByCid[c.customerId] = {deploys: deploysByCid[c.customerId], name: c.name};
            }
            console.log(deploysByCid);
            process.exit(0);
        });
    }
}
//main
getNgDeploy(0);
