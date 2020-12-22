var express = require("express");
var get = require('lodash.get');
var router = express.Router();
var url = require("url");
var config = require("../config");

var { search_payment_withReceiptNo, create_pdf,compareAmount,checkIfCitizen, search_billV2} = require("../api");
const { asyncMiddleware } = require("../utils/asyncMiddleware");

function renderError(res, errorMessage, errorCode) {
  if (errorCode == undefined) errorCode = 500;
  res.status(errorCode).send({ errorMessage });
}
/* GET users listing. */
router.post(
  "/consolidatedreceipt",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var param;
    param = req.query.consumerCode;
    if(!param)
    param = req.query.receiptNumbers; // data can be either in consumer code or receiptNumbers
    var billIds = req.query.billIds;
    var requestinfo = req.body;
    console.log("Tenantid ",tenantId)
    console.log("receiptNumbers ",param)
    console.log("billIds ",billIds)
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    //console.log("tenantId--",tenantId);
    if (!tenantId) {
      return renderError(
        res,
        "Enter tenant id to generate the receipt",
        400
      );
    }else if (!param && !billIds )
    {
    return renderError(
      res,
      "Enter mandatory fields to generate the receipt",
      400
    );
    }
    try {
      try {
        resProperty = await search_payment_withReceiptNo(param,billIds, tenantId, requestinfo);
      } catch (ex) {
        console.log(ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query details of the payment", 500);
      }
      var payments = resProperty.data;
      //console.log(JSON.stringify(payments));
      if (payments && payments.Payments && payments.Payments.length > 0) {
        if (checkIfCitizen(requestinfo)) {
          
          var mobileNumber = requestinfo.RequestInfo.userInfo.mobileNumber;
          var payerMobileNumber = get(payments,"Payments[0].mobileNumber",null) ;
          //console.log("PayerNumber",payerMobileNumber);
          var validCitizen =false
          if(payerMobileNumber == mobileNumber){
            validCitizen=true;
          }else{
            var consumerCode =get(payments,"Payments[0].paymentDetails[0].bill.consumerCode",null) ;
            var bService =get(payments,"Payments[0].paymentDetails[0].businessService",null) ;
            var searchBillResp = await search_billV2(tenantId, consumerCode,bService, requestinfo);
            var billMobileNumber =get(searchBillResp.data,"Bill[0].mobileNumber",null) ;
            //console.log("Biller Mobiler Number",billMobileNumber);
            if(billMobileNumber==mobileNumber){
              validCitizen=true;
            }
          }
          if(!validCitizen){
            return renderError(res, "Not Authorized to access resource", 403);
          }
        }
        if(payments.Payments[0].fileStoreId)
        {
          respObj = {
            filestoreIds:[payments.Payments[0].fileStoreId],
            ResponseInfo: requestinfo,
            key: config.pdf.consolidated_receipt_template
          }
          //console.log("respObj--",respObj);
          var filename = `${pdfkey}_${new Date().getTime()}`;
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename=${filename}.pdf`,
          }); 
         res.end(JSON.stringify(respObj));
        }
        else
        {
          var sortedObj = payments.Payments[0].paymentDetails[0].bill.billDetails[0].billAccountDetails;
        sortedObj.sort(compareAmount);
        payments.Payments[0].paymentDetails[0].bill.billDetails[0].billAccountDetails = sortedObj;
        tenantId = tenantId.split('.')[0];
        var pdfResponse;
        var pdfkey = config.pdf.consolidated_receipt_template;
        try {
          pdfResponse = await create_pdf(
            tenantId,
            pdfkey,
            payments,
            requestinfo
          );
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, "Failed to generate PDF for payment", 500);
        }

        var filename = `${pdfkey}_${new Date().getTime()}`;

        //pdfData = pdfResponse.data.read();
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${filename}.pdf`,
        });
        pdfResponse.data.pipe(res);
      }
      } else {
        return renderError(
          res,
          "There is no payment done by you for this id",
          404
        );
      }
    } catch (ex) {
      console.log(ex.stack);
    }
  })
);

module.exports = router;
