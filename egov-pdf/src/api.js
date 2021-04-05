var config = require("./config");
var axios = require("axios").default;
var url = require("url");

auth_token = config.auth_token;

function compareAmount(a,b)
  {
    if ( a.amount > b.amount ){
      return -1;
    }
    if ( a.amount < b.amount ){
      return 1;
    }
    return 0;
  }

async function search_user(uuid, tenantId, requestinfo) {
  return await axios({
    method: "post",
    url: url.resolve(config.host.user, config.paths.user_search),
    data: {
      RequestInfo: requestinfo.RequestInfo,
      uuid: [uuid],
      tenantId: tenantId,
    },
  });
}

async function search_epass(uuid, tenantId, requestinfo) {
  return await axios({
    method: "post",
    url: url.resolve(config.host.epass, config.paths.epass_search),
    data: requestinfo,
    params: {
      tenantId: tenantId,
      ids: uuid,
    },
  });
}

async function search_property(
  uuid,
  tenantId,
  requestinfo,
  allowCitizenTOSearchOthersRecords
) {
  // currently single property pdfs supported
  if (uuid.split(",").length > 1) {
    uuid = uuid.split(",")[0].trim();
  }
  var params = {
    tenantId: tenantId,
    uuids: uuid,
  };
  if (
    checkIfCitizen(requestinfo) &&
    allowCitizenTOSearchOthersRecords != true
  ) {
    var mobileNumber = requestinfo.RequestInfo.userInfo.mobileNumber;
    var userName = requestinfo.RequestInfo.userInfo.userName;
    //params["mobileNumber"] = mobileNumber || userName;
  }
  return await axios({
    method: "post",
    url: url.resolve(config.host.pt, config.paths.pt_search),
    data: requestinfo,
    params,
  });
}

async function search_workflow(applicationNumber, tenantId, requestinfo) {
  var params = {
    tenantId: tenantId,
    businessIds: applicationNumber,
  };
  return await axios({
    method: "post",
    url: url.resolve(config.host.workflow, config.paths.workflow_search),
    data: requestinfo,
    params,
  });
}

async function search_payment(consumerCodes, tenantId, requestinfo) {
  //console.log("consumerCodes--",consumerCodes,"tennant id--",tenantId);
  var params = {
    tenantId: tenantId,
    consumerCodes: consumerCodes,
  };
  if (checkIfCitizen(requestinfo)) {
    var mobileNumber = requestinfo.RequestInfo.userInfo.mobileNumber;
    var userName = requestinfo.RequestInfo.userInfo.userName;
    params["mobileNumber"] = mobileNumber || userName;
  }
  return await axios({
    method: "post",
    url: url.resolve(config.host.payments, config.paths.payment_search),
    data: requestinfo,
    params,
  });
}

async function search_payment_withReceiptNo(receiptNumbers,billIds, tenantId, requestinfo) {
 // console.log("receiptNumbers--",receiptNumbers,"tennant id--",tenantId,"billids--",billIds);
  var params;
  if(receiptNumbers)
    {
        params = {
        tenantId: tenantId,
        receiptNumbers: receiptNumbers,
      };
    }
    if(billIds)
  {
      params = {
        tenantId: tenantId,
        billIds: billIds,
      };
  }
  return await axios({
    method: "post",
    url: url.resolve(config.host.payments, config.paths.payment_search),
    data: requestinfo,
    params,
  });
}

async function search_bill(consumerCode, tenantId, requestinfo) {
  return await axios({
    method: "post",
    url: url.resolve(config.host.bill, config.paths.bill_search),
    data: requestinfo,
    params: {
      tenantId: tenantId,
      consumerCode: consumerCode,
    },
  });
}

async function search_tllicense(applicationNumber, tenantId, requestinfo) {
  //console.log("applicationNumber--",applicationNumber,"tennant id--",tenantId);
  var params = {
    tenantId: tenantId,
    applicationNumber: applicationNumber,
  };
  //Validation is added at service level.
  // if (checkIfCitizen(requestinfo)) {
  //   var mobileNumber = requestinfo.RequestInfo.userInfo.mobileNumber;
  //   var userName = requestinfo.RequestInfo.userInfo.userName;
  //   params["mobileNumber"] = mobileNumber || userName;
  // }
  //console.log("params--",params);
  return await axios({
    method: "post",
    url: url.resolve(config.host.tl, config.paths.tl_search),
    data: requestinfo,
    params,
  });
}

async function search_mdms(tenantId, mdmsBody, requestinfo) {
  console.log("mdmsBody--",JSON.stringify(mdmsBody))
  console.log("requestinfo--",JSON.stringify(requestinfo))
  return await axios({
    method: "post",
    url: url.resolve(config.host.mdms, config.paths.mdms_search),
    data: Object.assign(requestinfo, mdmsBody),  
  });
}

async function search_echallan(tenantId, challanNo,requestinfo) {
  return await axios({
    method: "post",
    url: url.resolve(config.host.challan, config.paths.mcollect_challan_search),
    data: requestinfo,
    params: {
      tenantId: tenantId,
      challanNo: challanNo,
    },
  });
}


async function search_bill_genie(data,requestinfo) {
 // console.log("data--",data);
  return await axios({
    method: "post",
    url: url.resolve(config.host.bill, config.paths.bill_genie_getBill),
    data: Object.assign(requestinfo, data),
  });
}

async function search_billV2(tenantId, consumerCode,serviceId,requestinfo) {
  //console.log("search_billV2 consumerCode--",consumerCode,"tenantId",tenantId,"serviceId",serviceId);
  return await axios({
    method: "post",
    url: url.resolve(config.host.mcollectBilling, config.paths.mcollect_bill),
    data: requestinfo,
    params: {
      tenantId: tenantId,
      consumerCode: consumerCode,
      service:serviceId
    },
  });
}

async function create_pdf(tenantId, key, data, requestinfo) {
  //console.log("key--",key,"data--",JSON.stringify(data),"tenantId--",tenantId , "reqq info--",JSON.stringify(requestinfo));
  //console.log("url",url.resolve(config.host.pdf, config.paths.pdf_create));
  //console.log("requestinfo--",url.resolve(config.host.pdf, config.paths.pdf_create));
  return await axios({
    responseType: "stream",
    method: "post",
    url: url.resolve(config.host.pdf, config.paths.pdf_create),
    data: Object.assign(requestinfo, data),
    params: {
      tenantId: tenantId,
      key: key,
    },
  });
}

function checkIfCitizen(requestinfo) {
  if (requestinfo.RequestInfo.userInfo.type == "CITIZEN") {
    return true;
  } else {
    return false;
  }
}

async function search_waterconnections(tenantId, applicationNumber,requestinfo) {
  return await axios({
    method: "post",
    url: url.resolve(config.host.ws, config.paths.ws_search),
    data: requestinfo,
    params: {
      tenantId: tenantId,
      applicationNumber: applicationNumber,
    },
  });
}
async function estimate(CalculationCriteria, isconnectionCalculation,requestinfo) {
response = await axios({
  method: "post",
  url: url.resolve(config.host.ws_calc, config.paths.estimate),
  data: {
    CalculationCriteria:CalculationCriteria,
    isconnectionCalculation:isconnectionCalculation,
    RequestInfo:requestinfo.RequestInfo
  },
  params:{
    
  }
  });
  return response;
}

async function search_sewerageconnections(tenantId, applicationNumber,requestinfo) {
  return await axios({
    method: "post",
    url: url.resolve(config.host.sw, config.paths.sw_search),
    data: requestinfo,
    params: {
      tenantId: tenantId,
      applicationNumber: applicationNumber,
    },
  });
}
async function estimate_sw(CalculationCriteria, isconnectionCalculation,requestinfo) {
  response = await axios({
    method: "post",
    url: url.resolve(config.host.sw_calc, config.paths.estimate_sw),
    data: {
      CalculationCriteria:CalculationCriteria,
      isconnectionCalculation:isconnectionCalculation,
      RequestInfo:requestinfo.RequestInfo
    },
    params:{
      
    }
    });
    return response;
  }

  async function wf_bs_search(tenantId, businessService,requestinfo) {
    return await axios({
      method: "post",
      url: url.resolve(config.host.workflow, config.paths.wf_bs_search),
      data: requestinfo,
      params: {
        tenantId: tenantId,
        businessService: businessService,
      },
    });
  }
  
module.exports = {
  create_pdf,
  search_epass,
  search_mdms,
  search_user,
  search_property,
  search_bill,
  search_payment,
  search_tllicense,
  search_workflow,
  search_echallan,
  search_billV2,
  search_bill_genie,
  search_payment_withReceiptNo,
  compareAmount,
  search_waterconnections,
  estimate,
  search_sewerageconnections,
  estimate_sw,
  wf_bs_search,
  checkIfCitizen
};
