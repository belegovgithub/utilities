var express = require("express");
var router = express.Router();
var config = require("../config");
var {
  search_waterconnections,
  search_mdms,
  search_water_bill,
  search_demand_byid,
  search_property_with_propnumber,
  create_pdf,
  estimate,
  search_sewerageconnections,
  estimate_sw,
  wf_bs_search,
  wf_process_search
} = require("../api");
const { asyncMiddleware } = require("../utils/asyncMiddleware");
function renderError(res, errorMessage, errorCode) {
  if (errorCode == undefined) errorCode = 500;
  res.status(errorCode).send({ errorMessage });
}

router.post(
  "/ws-estimationnotice",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var applicationNumber = req.query.applicationNumber;
    var requestinfo = req.body;
    var service = req.query.service;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !applicationNumber) {
      return renderError(
        res,
        "tenantId and applicationNumber are mandatory to generate the estimate notice",
        400
      );
    }
    try {
      try {
        if (service == "WATER") {
          searchResults = await search_waterconnections(
            tenantId,
            applicationNumber,
            requestinfo
          );
          WaterConnection = searchResults.data.WaterConnection;
        } else {
          searchResults = await search_sewerageconnections(
            tenantId,
            applicationNumber,
            requestinfo
          );
          WaterConnection = searchResults.data.SewerageConnections;
        }
      } catch (ex) {
        console.log("error", ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query connection details", 500);
      }
      //console.log("WaterConnection--",JSON.stringify(WaterConnection));
      // var wc = waterConnections.data;
      var wcObj;
      if (WaterConnection && WaterConnection && WaterConnection.length > 0) {
        wcObj = WaterConnection[0];
        if (wcObj.additionalDetails.estimationFileStoreId) {
          respObj = {
            filestoreIds: [wcObj.additionalDetails.estimationFileStoreId],
            ResponseInfo: requestinfo,
            key: config.pdf.ws_estimate_template,
          };
          var filename = `${pdfkey}_${new Date().getTime()}`;
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${filename}.pdf`,
          });
          res.end(JSON.stringify(respObj));
        } else {
          var propertId = WaterConnection[0].propertyId;
          var propertyDtls;
          //console.log("propertyID--",propertId);
          try {
            propertyDtls = await search_property_with_propnumber(
              propertId,
              tenantId,
              requestinfo
            );
          } catch (ex) {
            console.log(ex.stack);
            if (ex.response && ex.response.data) console.log(ex.response.data);
            return renderError(
              res,
              `Failed to query property details`,
              500
            );
          }
          var propertyDtl = propertyDtls.data;
          //console.log("propertyDtl--", JSON.stringify(propertyDtl));
          if (
            propertyDtl &&
            propertyDtl.Properties &&
            propertyDtl.Properties.length > 0
          ) {
            wcObj.property = propertyDtl.Properties[0];
            if(wcObj.connectionHolders==null ||wcObj.connectionHolders.length ==0  ){
              wcObj.connectionHolders = wcObj.property["owners"]
            } 
            wcObj.service = service;
            var tenantName = WaterConnection[0].property.tenantId;
            tenantName = tenantName.split(".")[1];
            wcObj.tenantName = tenantName.toUpperCase();
            //estimate
            try {
              if (service == "WATER") {
                if (
                  wcObj.property.rainWaterHarvesting !== undefined &&
                  wcObj.property.rainWaterHarvesting !== null
                ) {
                  if (wcObj.property.rainWaterHarvesting === "SCORE_YES") {
                    wcObj.property.rainWaterHarvesting = true;
                  } else if (
                    wcObj.property.rainWaterHarvesting === "SCORE_NO"
                  ) {
                    wcObj.property.rainWaterHarvesting = false;
                  }
                }
                console.log("applicationNumber--",applicationNumber);
                var queryObjectForEst = [
                  {
                    applicationNo: applicationNumber,
                    tenantId: tenantId,
                    waterConnection: WaterConnection[0],
                  },
                ];
                estResponse = await estimate(
                  queryObjectForEst,
                  false,
                  requestinfo
                );
              } else {
                var queryObjectForEst = [
                  {
                    applicationNo: applicationNumber,
                    tenantId: tenantId,
                    sewerageConnection: WaterConnection[0],
                  },
                ];
                estResponse = await estimate_sw(
                  queryObjectForEst,
                  false,
                  requestinfo
                );
              }
            } catch (ex) {
              console.log(ex.stack);
              if (ex.response && ex.response.data)
                console.log(ex.response.data);
              return renderError(
                res,
                `Failed to query bill for mcollect-challan`,
                500
              );
            }
           //console.log("estResponse--",estResponse);
            wcObj.totalAmount = estResponse.data.Calculation[0].totalAmount;
            wcObj.applicationFee = estResponse.data.Calculation[0].fee;
            wcObj.serviceFee = estResponse.data.Calculation[0].charge;
            wcObj.tax = estResponse.data.Calculation[0].taxAmount;
            estResponse.data.Calculation[0].taxHeadEstimates.map((val) => {
              val.taxHeadCode = val.taxHeadCode.substring(3);
            });
            wcObj.pdfTaxhead = estResponse.data.Calculation[0].taxHeadEstimates;
            var finalObj = { WnsConnection: WaterConnection };
            //console.log("final object--", JSON.stringify(finalObj));
            tenantId = tenantId.split(".")[0];
            var pdfResponse;
            const defaultLocale = "en_IN"
            let locale = requestinfo.RequestInfo.msgId;
           // console.log("locale--",requestinfo.RequestInfo.msgId);
            //console.log("locale1--",locale);
            if (null != locale) {
              locale = locale.split("|");
              locale = locale.length > 1 ? locale[1] : defaultLocale;
            } else {
              locale = defaultLocale;
            }
            //console.log("locale1--",locale);
            if (service == "WATER")
            var pdfkey = locale == "hi_IN" ? wcObj.applicationType == 'NEW_WATER_CONNECTION' ? config.pdf.ws_estimate_template_hi : config.pdf.ws_modify_estimate_template_hi : wcObj.applicationType == 'NEW_WATER_CONNECTION' ? config.pdf.ws_estimate_template : config.pdf.ws_modify_estimate_template
            else
            var pdfkey = locale == "hi_IN" ? config.pdf.sw_estimate_template_hi : config.pdf.sw_estimate_template
            //var pdfkey = config.pdf.ws_estimate_template;
            console.log("pdfkey--",pdfkey);
            try {
              pdfResponse = await create_pdf(
                tenantId,
                pdfkey,
                finalObj,
                requestinfo
              );
            } catch (ex) {
              return renderError(
                res,
                "Failed to generate PDF for ws Estimate notice",
                500
              );
            }
            var filename = `${pdfkey}_${new Date().getTime()}`;
            res.writeHead(200, {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename=${filename}.pdf`,
            });
            pdfResponse.data.pipe(res);
          } else {
            return renderError(
              res,
              "There is no estimate notice for this id",
              404
            );
          }
        }
      } else {
        return renderError(
          res,
          "There is no estimate notice for you for this applicationNumber",
          404
        );
      }
    } catch (ex) {
      console.log(ex.stack);
    }
  })
);

router.post(
  "/ws-sanctionletter",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var applicationNumber = req.query.applicationNumber;
    var requestinfo = req.body;
    var service = req.query.service;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !applicationNumber) {
      return renderError(
        res,
        "tenantId and applicationNumber are mandatory to generate the estimate notice",
        400
      );
    }
    try {
      try {
        if (service == "WATER") {
          searchResults = await search_waterconnections(
            tenantId,
            applicationNumber,
            requestinfo
          );
          WaterConnection = searchResults.data.WaterConnection;
        } else {
          searchResults = await search_sewerageconnections(
            tenantId,
            applicationNumber,
            requestinfo
          );
          WaterConnection = searchResults.data.SewerageConnections;
        }
      } catch (ex) {
        console.log("error", ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query connection details", 500);
      }

      // var wc = waterConnections.data;
      // console.log("wc---",WaterConnection)
      var wcObj;
      if (WaterConnection && WaterConnection && WaterConnection.length > 0) {
        wcObj = WaterConnection[0];
        if (wcObj.additionalDetails.sanctionFileStoreId) {
          respObj = {
            filestoreIds: [wcObj.additionalDetails.sanctionFileStoreId],
            ResponseInfo: requestinfo,
            key: config.pdf.ws_sanction_template,
          };
          var filename = `${pdfkey}_${new Date().getTime()}`;
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${filename}.pdf`,
          });
          res.end(JSON.stringify(respObj));
        } else {
          var propertId = WaterConnection[0].propertyId;
          var propertyDtls;
          try {
            propertyDtls = await search_property_with_propnumber(
              propertId,
              tenantId,
              requestinfo
            );
          } catch (ex) {
            console.log(ex.stack);
            if (ex.response && ex.response.data) console.log(ex.response.data);
            return renderError(
              res,
              `Failed to query bill for mcollect-challan`,
              500
            );
          }
          var propertyDtl = propertyDtls.data;
         // console.log("propertyDtl--"+propertyDtl)
          if (
            propertyDtl &&
            propertyDtl.Properties &&
            propertyDtl.Properties.length > 0
          ) {
            wcObj.property = propertyDtl.Properties[0];
            if(wcObj.connectionHolders==null ||wcObj.connectionHolders.length ==0  ){
              wcObj.connectionHolders = wcObj.property["owners"]
            } 
            wcObj.service = service;
            var tenantName = WaterConnection[0].property.tenantId;
            tenantName = tenantName.split(".")[1];
            wcObj.tenantName = tenantName.toUpperCase();
            //estimate
            try {
              if (service == "WATER") {
                if (
                  wcObj.property.rainWaterHarvesting !== undefined &&
                  wcObj.property.rainWaterHarvesting !== null
                ) {
                  if (wcObj.property.rainWaterHarvesting === "SCORE_YES") {
                    wcObj.property.rainWaterHarvesting = true;
                  } else if (
                    wcObj.property.rainWaterHarvesting === "SCORE_NO"
                  ) {
                    wcObj.property.rainWaterHarvesting = false;
                  }
                }

                var queryObjectForEst = [
                  {
                    applicationNo: applicationNumber,
                    tenantId: tenantId,
                    waterConnection: WaterConnection[0],
                  },
                ];
                estResponse = await estimate(
                  queryObjectForEst,
                  false,
                  requestinfo
                );
              } else {
                var queryObjectForEst = [
                  {
                    applicationNo: applicationNumber,
                    tenantId: tenantId,
                    sewerageConnection: WaterConnection[0],
                  },
                ];
                estResponse = await estimate_sw(
                  queryObjectForEst,
                  false,
                  requestinfo
                );
              }
            } catch (ex) {
              console.log(ex.stack);
              if (ex.response && ex.response.data)
                console.log(ex.response.data);
              return renderError(
                res,
                `Failed to query bill for mcollect-challan`,
                500
              );
            }
           // console.log("estResponse--"+estResponse)
            wcObj.totalAmount = estResponse.data.Calculation[0].totalAmount;
            wcObj.applicationFee = estResponse.data.Calculation[0].fee;
            wcObj.serviceFee = estResponse.data.Calculation[0].charge;
            wcObj.tax = estResponse.data.Calculation[0].taxAmount;
            estResponse.data.Calculation[0].taxHeadEstimates.map((val) => {
              val.taxHeadCode = val.taxHeadCode.substring(3);
            });
            wcObj.pdfTaxhead = estResponse.data.Calculation[0].taxHeadEstimates;

            workflowResp = await wf_bs_search(tenantId, "WS", requestinfo);

            var slaDetails = workflowResp.data;
            //console.log("slaDetails---"+JSON.stringify(slaDetails));
            var states = [],
              findSLA = false;
              var isModifyConnection = false;
            for (var i = 0; i < slaDetails.BusinessServices.length; i++) {
              states = slaDetails.BusinessServices[i].states;
              if (findSLA) break;
              if (states.length > 0) {
                for (var j = 0; j < states.length; j++) {
                  if (
                    states[j]["state"] &&
                    states[j]["state"] !== undefined &&
                    states[j]["state"] !== null &&
                    states[j]["state"] !== "" &&
                    states[j]["state"] === "PENDING_FOR_CONNECTION_ACTIVATION"
                  ) {
                    if(slaDetails.BusinessServices[i].businessService == "ModifyWSConnection1")
                    {
                      isModifyConnection = true;
                      break;
                    }
                    wcObj.sla = states[j]["sla"] / 86400000;
                    findSLA = true;
                    break;
                  }
                }
              }
              if(!isModifyConnection)
              {
              try
              {
                workflowRespObj  = await wf_process_search(tenantId, applicationNumber, true , requestinfo);
                var processDetail = workflowRespObj.data;
                
                for (var i = 0; i < processDetail.ProcessInstances.length; i++) {
                  procState = processDetail.ProcessInstances[i];
                  if (procState["action"] && 
                      procState["action"] !== undefined &&
                      procState["action"] !== null &&
                      procState["action"] === "PAY"
                  ){
                    console.log("PAY state ",JSON.stringify(procState["auditDetails"]) )
                    if(wcObj.auditDetails.lastModifiedTime ){
                      wcObj.auditDetails.lastModifiedTime =procState["auditDetails"]["lastModifiedTime"];
                    } 
                  }
                }
              }catch(ex_wk){
                console.log(ex_wk.stack);
              }    
            }
            else
            {
              return renderError(
                res,
                "Sanction letter is not available for modify connection",
                400
              );
            }
            }
            let connectionExecutionDate = new Date(
              wcObj.connectionExecutionDate
            );
            wcObj.slaDate = connectionExecutionDate.setDate(
              connectionExecutionDate.getDate() + wcObj.sla
            );

            var finalObj = { WnsConnection: WaterConnection };
            tenantId = tenantId.split(".")[0];
            var pdfResponse;
            const defaultLocale = "en_IN"
            let locale = requestinfo.RequestInfo.msgId;
            if (null != locale) {
              locale = locale.split("|");
              locale = locale.length > 1 ? locale[1] : defaultLocale;
            } else {
              locale = defaultLocale;
            }
           // console.log("defaultLocale--",locale);
           if (service == "WATER")
           var pdfkey = locale == "hi_IN" ? config.pdf.ws_sanction_template_hi : config.pdf.ws_sanction_template
           else
           var pdfkey = locale == "hi_IN" ? config.pdf.sw_sanction_template_hi : config.pdf.sw_sanction_template
           console.log("pdfkey--"+pdfkey);
            try {
              pdfResponse = await create_pdf(
                tenantId,
                pdfkey,
                finalObj,
                requestinfo
              );
            } catch (ex) {
              return renderError(
                res,
                "Failed to generate PDF for ws sanction letter",
                500
              );
            }
            var filename = `${pdfkey}_${new Date().getTime()}`;
            res.writeHead(200, {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename=${filename}.pdf`,
            });
            pdfResponse.data.pipe(res);
          } else {
            return renderError(
              res,
              "There is no estimate notice for this id",
              404
            );
          }
        }
      } else {
        return renderError(
          res,
          "There is no estimate notice for you for this applicationNumber",
          404
        );
      }
    } catch (ex) {
      console.log(ex.stack);
    }
  })
);

router.post(
  "/ws-red-notice",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var applicationNumber = req.query.applicationNumber;
    var requestinfo = req.body;
    var service = req.query.service;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !applicationNumber) {
      return renderError(
        res,
        "tenantId and applicationNumber are mandatory to generate the estimate notice",
        400
      );
    }
    try {
      try {
        if (service == "WATER") {
          searchResults = await search_waterconnections(
            tenantId,
            applicationNumber,
            requestinfo
          );
          WaterConnection = searchResults.data.WaterConnection;
        } else {
          searchResults = await search_sewerageconnections(
            tenantId,
            applicationNumber,
            requestinfo
          );
          WaterConnection = searchResults.data.SewerageConnections;
        }
      } catch (ex) {
        console.log("error", ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query connection details", 500);
      }

      // var wc = waterConnections.data;
       //console.log("wc---",WaterConnection)
      var wcObj;
      if (WaterConnection && WaterConnection && WaterConnection.length > 0) {
        wcObj = WaterConnection[0];
        if (wcObj.additionalDetails.sanctionFileStoreId) {
          respObj = {
            filestoreIds: [wcObj.additionalDetails.sanctionFileStoreId],
            ResponseInfo: requestinfo,
            key: config.pdf.ws_sanction_template,
          };
          var filename = `${pdfkey}_${new Date().getTime()}`;
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${filename}.pdf`,
          });
          res.end(JSON.stringify(respObj));
        } else {
          var propertId = WaterConnection[0].propertyId;
          var propertyDtls;
          try {
            propertyDtls = await search_property_with_propnumber(
              propertId,
              tenantId,
              requestinfo
            );
          } catch (ex) {
            console.log(ex.stack);
            if (ex.response && ex.response.data) console.log(ex.response.data);
            return renderError(
              res,
              `Failed to query bill for mcollect-challan`,
              500
            );
          }
          var propertyDtl = propertyDtls.data;
         // console.log("propertyDtl--"+propertyDtl)
          if (
            propertyDtl &&
            propertyDtl.Properties &&
            propertyDtl.Properties.length > 0
          ) {
            wcObj.property = propertyDtl.Properties[0];
            if(wcObj.connectionHolders==null ||wcObj.connectionHolders.length ==0  ){
              wcObj.connectionHolders = wcObj.property["owners"]
            } 
            wcObj.service = service;
            var tenantName = WaterConnection[0].property.tenantId;
            tenantName = tenantName.split(".")[1];
            wcObj.tenantName = tenantName.toUpperCase();
            //estimate
            try {
              if (service == "WATER") {
                if (
                  wcObj.property.rainWaterHarvesting !== undefined &&
                  wcObj.property.rainWaterHarvesting !== null
                ) {
                  if (wcObj.property.rainWaterHarvesting === "SCORE_YES") {
                    wcObj.property.rainWaterHarvesting = true;
                  } else if (
                    wcObj.property.rainWaterHarvesting === "SCORE_NO"
                  ) {
                    wcObj.property.rainWaterHarvesting = false;
                  }
                }

                var queryObjectForEst = [
                  {
                    applicationNo: applicationNumber,
                    tenantId: tenantId,
                    waterConnection: WaterConnection[0],
                  },
                ];
                estResponse = await estimate(
                  queryObjectForEst,
                  false,
                  requestinfo
                );
              } else {
                var queryObjectForEst = [
                  {
                    applicationNo: applicationNumber,
                    tenantId: tenantId,
                    sewerageConnection: WaterConnection[0],
                  },
                ];
                estResponse = await estimate_sw(
                  queryObjectForEst,
                  false,
                  requestinfo
                );
              }
            } catch (ex) {
              console.log(ex.stack);
              if (ex.response && ex.response.data)
                console.log(ex.response.data);
              return renderError(
                res,
                `Failed to query bill for mcollect-challan`,
                500
              );
            }
            //console.log("estResponse--"+estResponse)
            wcObj.totalAmount = estResponse.data.Calculation[0].totalAmount;
            wcObj.applicationFee = estResponse.data.Calculation[0].fee;
            wcObj.serviceFee = estResponse.data.Calculation[0].charge;
            wcObj.tax = estResponse.data.Calculation[0].taxAmount;
            estResponse.data.Calculation[0].taxHeadEstimates.map((val) => {
              val.taxHeadCode = val.taxHeadCode.substring(3);
            });
            wcObj.pdfTaxhead = estResponse.data.Calculation[0].taxHeadEstimates;

            workflowResp = await wf_bs_search(tenantId, "WS", requestinfo);

            var slaDetails = workflowResp.data;
            //console.log("slaDetails---"+JSON.stringify(slaDetails));
            var states = [],
              findSLA = false;
              var isModifyConnection = false;
            for (var i = 0; i < slaDetails.BusinessServices.length; i++) {
              states = slaDetails.BusinessServices[i].states;
              if (findSLA) break;
              if (states.length > 0) {
                for (var j = 0; j < states.length; j++) {
                  if (
                    states[j]["state"] &&
                    states[j]["state"] !== undefined &&
                    states[j]["state"] !== null &&
                    states[j]["state"] !== "" &&
                    states[j]["state"] === "PENDING_FOR_CONNECTION_ACTIVATION"
                  ) {
                    if(slaDetails.BusinessServices[i].businessService == "ModifyWSConnection1")
                    {
                      isModifyConnection = true;
                      break;
                    }
                    wcObj.sla = states[j]["sla"] / 86400000;
                    findSLA = true;
                    break;
                  }
                }
              }
              if(!isModifyConnection)
              {
              try
              {
                workflowRespObj  = await wf_process_search(tenantId, applicationNumber, true , requestinfo);
                var processDetail = workflowRespObj.data;
                
                for (var i = 0; i < processDetail.ProcessInstances.length; i++) {
                  procState = processDetail.ProcessInstances[i];
                  if (procState["action"] && 
                      procState["action"] !== undefined &&
                      procState["action"] !== null &&
                      procState["action"] === "PAY"
                  ){
                    console.log("PAY state ",JSON.stringify(procState["auditDetails"]) )
                    if(wcObj.auditDetails.lastModifiedTime ){
                      wcObj.auditDetails.lastModifiedTime =procState["auditDetails"]["lastModifiedTime"];
                    } 
                  }
                }
              }catch(ex_wk){
                console.log(ex_wk.stack);
              }    
            }
            else
            {
              return renderError(
                res,
                "Sanction letter is not available for modify connection",
                400
              );
            }
            }
            let connectionExecutionDate = new Date(
              wcObj.connectionExecutionDate
            );
            wcObj.slaDate = connectionExecutionDate.setDate(
              connectionExecutionDate.getDate() + wcObj.sla
            );

            var finalObj = { WnsConnection: WaterConnection };
            tenantId = tenantId.split(".")[0];
            var pdfResponse;
            const defaultLocale = "en_IN"
            let locale = requestinfo.RequestInfo.msgId;
            if (null != locale) {
              locale = locale.split("|");
              locale = locale.length > 1 ? locale[1] : defaultLocale;
            } else {
              locale = defaultLocale;
            }
           // console.log("defaultLocale--",locale);
           //if (service == "WATER")
           var pdfkey = locale == "hi_IN" ? config.pdf.ws_red_notice_template : config.pdf.ws_red_notice_template
          // else
          // var pdfkey = locale == "hi_IN" ? config.pdf.sw_sanction_template_hi : config.pdf.sw_sanction_template
            try {
              pdfResponse = await create_pdf(
                tenantId,
                pdfkey,
                finalObj,
                requestinfo
              );
            } catch (ex) {
              return renderError(
                res,
                "Failed to generate PDF for ws sanction letter",
                500
              );
            }
            var filename = `${pdfkey}_${new Date().getTime()}`;
            res.writeHead(200, {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename=${filename}.pdf`,
            });
            pdfResponse.data.pipe(res);
          } else {
            return renderError(
              res,
              "There is no estimate notice for this id",
              404
            );
          }
        }
      } else {
        return renderError(
          res,
          "There is no estimate notice for you for this applicationNumber",
          404
        );
      }
    } catch (ex) {
      console.log(ex.stack);
    }
  })
);


router.post(
  "/waterbill",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var consumerNo = req.query.consumerNo;
    var businessServ = req.query.businessService;
    var requestinfo = req.body;
    const businessService = businessServ.includes("WS") ? "WS" : "SW";
    //propertyIds = propertyId.split(",");
    console.log("consumerNo---",consumerNo);
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !consumerNo) {
      return renderError(
        res,
        "tenantId and consumerNo are mandatory to generate the water bill",
        400
      );
    }
    
    try {
      const mdmsRequestBody = {
        "MdmsCriteria": {
            "tenantId": tenantId,
            "moduleDetails": [
                { "moduleName": "ws-services-masters", "masterDetails": [{ "name": "billingPeriod" }] },
                { "moduleName": "sw-services-calculation", "masterDetails": [{ "name": "billingPeriod" }] }
            ]
        }
    }
       
      if (consumerNo) {
        var BillData = [];
        var billresponse;
        try {
          billresponse = await search_water_bill(consumerNo, tenantId, requestinfo,businessService); // search bill for the corresponding property id
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query bills for property`, 500);
        }
        var bills = billresponse.data;
        //console.log("bills orig--",JSON.stringify(bills));
        if( bills &&
          bills.Bill &&
          bills.Bill.length > 0)
          {
            for(let i=0;i<bills.Bill.length;i++) // Loop for multiple property ids
            {
            let data = [];
            bills.Bill[i].billDetails.map(curEl => data.push(curEl));
            let sortData = data.sort((a, b) => b.toPeriod - a.toPeriod);
            let tenant = sortData[0].tenantId;
            let demandId = sortData[0].demandId;
            const queryString = [
                { key: "demandId", value: demandId },
                { key: "tenantId", value: tenant }
            ]
            let billTotalAmount = bills.Bill[i].totalAmount;
            var demandResponse = await search_demand_byid(demandId, tenantId, requestinfo); 
            var demandData = demandResponse.data;
            //console.log("demandResponse orig--",JSON.stringify(demandData));
            let demandAmount = demandData.Demands[0].demandDetails.reduce((accum, item) => accum + item.taxAmount, 0);
            let partiallyPaid = demandData.Demands[0].demandDetails.reduce((accm, item) => accm + item.collectionAmount, 0);
            if (billTotalAmount <= 0) {
              // We do have Advance. This value is already adjusted from the actual demand.
              // i.e. The entire demand is adjusted hence billTotalAmount becomes <= 0
              bills.Bill[i].AdvanceAdjustedValue = partiallyPaid > 0 ? partiallyPaid : 0;
          } else {
                    // We have some Bill Amount. There are two possibilities.
                    // 1 - There was some advance and it is adjusted
                    // 2 - This is the balance of the previous Bill amount after partial payment - no adjustment
                    if (partiallyPaid >= 0) {
                      //There is some amount paid partially. Hence AdvanceAdjusted must be 0
                      bills.Bill[i].AdvanceAdjustedValue = 0;
                       } else {
                                bills.Bill[i].AdvanceAdjustedValue = demandAmount - billTotalAmount;
                              }
          }
          if (billTotalAmount > 0) {
            sortData.shift();
            let totalAmount = 0;
            let previousArrears = 0;
            if (sortData.length > 0) {
                let totalArrearsAmount = sortData.map(el => el.amount + totalAmount);
                previousArrears = totalArrearsAmount.reduce((a, b) => a + b);
            }
            bills.Bill[i].arrearAmount = previousArrears.toFixed(2);
        }
        bills.Bill[i].billDetails.sort((a, b) => b.toPeriod - a.toPeriod);
        var mdmsResponse = await search_mdms(tenantId, mdmsRequestBody, requestinfo); 
        console.log("mdmsResponse orig--",JSON.stringify(mdmsResponse.data.MdmsRes));
        let waterMeteredDemandExipryDate = 0, waterNonMeteredDemandExipryDate = 0, sewerageNonMeteredDemandExpiryDate = 0;
        const service = (bills.Bill && bills.Bill.length > 0 && bills.Bill[i].businessService) ? bills.Bill[i].businessService : 'WS';
        if (service === 'WS' &&
            mdmsResponse.data.MdmsRes['ws-services-masters'] &&
            mdmsResponse.data.MdmsRes['ws-services-masters'].billingPeriod !== undefined &&
            mdmsResponse.data.MdmsRes['ws-services-masters'].billingPeriod !== null) {
              mdmsResponse.data.MdmsRes['ws-services-masters'].billingPeriod.forEach(obj => {
                if (obj.connectionType === 'Metered') {
                    bills.Bill[i].billDetails[0]['expiryDate'] = bills.Bill[i].billDetails[0].toPeriod + obj.demandExpiryDate;
                } else if (obj.connectionType === 'Non Metered') {
                    bills.Bill[i].billDetails[0]['expiryDate'] = bills.Bill[i].billDetails[0].toPeriod + obj.demandExpiryDate;
                }
            });
        }

        if (service === "SW" &&
        mdmsResponse.data.MdmsRes['sw-services-calculation'] &&
        mdmsResponse.data.MdmsRes['sw-services-calculation'].billingPeriod !== undefined &&
        mdmsResponse.data.MdmsRes['sw-services-calculation'].billingPeriod !== null) {
          mdmsResponse.data.MdmsRes['sw-services-calculation'].billingPeriod.forEach(obj => {
                if (obj.connectionType === 'Non Metered') {
                    bills.Bill[i].billDetails[0]['expiryDate'] = bills.Bill[i].billDetails[0].toPeriod + obj.demandExpiryDate;
                }
            });
        }
            //water data   
        
        
        
            BillData.push(bills.Bill[i]);
       // console.log("demand orig--",JSON.stringify(demand));
       
    }
        }
      
      //console.log("bills--",JSON.stringify(BillData));
        if (BillData && BillData.length > 0) {
          var pdfResponse;
          var pdfkey = config.pdf.wsbill_pdf_template;
          tenantId = tenantId.split('.')[0];
          try {
            var billArray = { Bill: BillData };
            pdfResponse = await create_pdf(
              tenantId,
              pdfkey,
              billArray,
              requestinfo
            );
          } catch (ex) {
            console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
            return renderError(res, "Failed to generate PDF for property", 500);
          }
          var filename = `${pdfkey}_${new Date().getTime()}`;

          //pdfData = pdfResponse.data.read();
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${filename}.pdf`,
          });
          pdfResponse.data.pipe(res);
        } else {
          return renderError(res, "There is no demand for this id", 404);
        }
      } else {
        return renderError(
          res,
          "There is no property for you for this id",
          404
        );
      }
    } catch (ex) {
      console.log(ex.stack);
    }
  })
);


module.exports = router;
