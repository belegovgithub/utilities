var express = require("express");
var router = express.Router();
var config = require("../config");
var {
  search_waterconnections,
  search_property,
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
      //console.log("WaterConnection--",WaterConnection);
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
          console.log("propertyID--",propertId);
          try {
            propertyDtls = await search_property(
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
            console.log("estResponse--",estResponse);
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
            console.log("locale--",requestinfo.RequestInfo.msgId);
            console.log("locale1--",locale);
            if (null != locale) {
              locale = locale.split("|");
              locale = locale.length > 1 ? locale[1] : defaultLocale;
            } else {
              locale = defaultLocale;
            }
            if (service == "WATER")
            var pdfkey = locale == "hi_IN" ? config.pdf.ws_estimate_template_hi : config.pdf.ws_estimate_template
            else
            var pdfkey = locale == "hi_IN" ? config.pdf.sw_estimate_template_hi : config.pdf.sw_estimate_template
            //var pdfkey = config.pdf.ws_estimate_template;
            //console.log("pdfkey--",pdfkey);
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
      var wcObj;
      if (WaterConnection && WaterConnection && WaterConnection.length > 0) {
        wcObj = WaterConnection[0];
        var always_generate_pdf =true;
        if (!always_generate_pdf) {
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
            propertyDtls = await search_property(
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
            var states = [],
              findSLA = false;
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
                    wcObj.sla = states[j]["sla"] / 86400000;
                    findSLA = true;
                    break;
                  }
                }
              }

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

module.exports = router;
