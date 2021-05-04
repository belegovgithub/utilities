var express = require("express");
var router = express.Router();
var url = require("url");
var config = require("../config");

var {
  search_property,
  search_bill,
  search_payment,
  create_pdf,
  search_workflow,
  search_property_with_propnumber,
  sortTaxhead
} = require("../api");

const { asyncMiddleware } = require("../utils/asyncMiddleware");

function renderError(res, errorMessage, errorCode) {
  if (errorCode == undefined) errorCode = 500;
  res.status(errorCode).send({ errorMessage });
}

/* GET users listing. */
router.post(
  "/ptmutationcertificate",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var uuid = req.query.uuid;
    var requestinfo = req.body;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !uuid) {
      return renderError(
        res,
        "tenantId and uuid are mandatory to generate the ptmutationcertificate",
        400
      );
    }

    try {
      try {
        resProperty = await search_property(uuid, tenantId, requestinfo);
      } catch (ex) {
        console.log(ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query details of the property", 500);
      }
      var properties = resProperty.data;

      if (
        properties &&
        properties.Properties &&
        properties.Properties.length > 0
      ) {
        var creationReason = properties.Properties[0].creationReason;
        if (creationReason != "MUTATION")
          return renderError(
            res,
            "ptmutation certificate allowed only on mutation applications",
            400
          );
        try {
          var applicationNumber = properties.Properties[0].acknowldgementNumber;
          var workflowResponse = await search_workflow(
            applicationNumber,
            tenantId,
            requestinfo
          );
          var status = workflowResponse.data.ProcessInstances[0].state.state;
          if (status != "APPROVED")
            return renderError(
              res,
              `ptmutation certificate allowed only on Approved status, but current application status is ${status}`,
              400
            );
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(
            res,
            "Failed to get status for property from workflow",
            500
          );
        }
        var pdfResponse;
        var pdfkey = config.pdf.ptmutationcertificate_pdf_template;
        try {
          pdfResponse = await create_pdf(
            tenantId,
            pdfkey,
            properties,
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

router.post(
  "/ptbill",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var uuid = req.query.uuid;
    var requestinfo = req.body;
    //console.log("request--",req);
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !uuid) {
      return renderError(
        res,
        "tenantId and uuid are mandatory to generate the ptbill",
        400
      );
    }
    try {
      try {
        resProperty = await search_property(uuid, tenantId, requestinfo, true);
      } catch (ex) {
        console.log(ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query details of the property", 500);
      }
      var properties = resProperty.data;
      if (
        properties &&
        properties.Properties &&
        properties.Properties.length > 0
      ) {
        var propertyid = properties.Properties[0].propertyId;
        var billresponse;
        try {
          billresponse = await search_bill(propertyid, tenantId, requestinfo);
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query bills for property`, 500);
        }
        var bills = billresponse.data;
        if (bills && bills.Bills && bills.Bills.length > 0) {
          var pdfResponse;
          var pdfkey = config.pdf.ptbill_pdf_template;
          try {
            var billArray = { Bill: bills.Bills };
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
          return renderError(res, "There is no bill for this id", 404);
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


router.post(
  "/propertybill",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var propertyId = req.query.propertyId;
    var requestinfo = req.body;
    //propertyIds = propertyId.split(",");
    //console.log("propertyIds---",propertyIds);
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !propertyId) {
      return renderError(
        res,
        "tenantId and propertyId are mandatory to generate the ptbill",
        400
      );
    }
    try {
      try {
        resProperty = await search_property_with_propnumber(
          propertyId,
          tenantId,
          requestinfo
        );
      } catch (ex) {
        console.log(ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query details of the property", 500);
      }
      var properties = resProperty.data;
      //console.log("properties--",JSON.stringify(properties));
      if (
        properties &&
        properties.Properties &&
        properties.Properties.length > 0
      ) {
        var propertyid = properties.Properties[0].propertyId;
        var billresponse;
        try {
          billresponse = await search_bill(propertyid, tenantId, requestinfo);
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query bills for property`, 500);
        }
        var bills = billresponse.data;
        //console.log("bills orig--",JSON.stringify(bills));
        var format = /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
        if(format.test(properties.Properties[0].usageCategory))
        properties.Properties[0].usageCategory.replace(/./g,"_");
        bills.Bills[0].usageCategory = properties.Properties[0].usageCategory;
        bills.Bills[0].oldPropertyId = properties.Properties[0].oldPropertyId;
        if(properties.Properties[0].units)
        bills.Bills[0].arv = properties.Properties[0].units[0].arv;
        
        bills.Bills[0].billDetails.sort(function(x,y){
          return y.fromPeriod - x.fromPeriod
        })
        bills.Bills[0].billDetails.map(function(x){
           x.billAccountDetails.sort(function(x,y){
              return x.order - y.order
           })
        })
        //console.log("bills sorted--",JSON.stringify(bills));
        let temp =[];
        //console.log(JSON.stringify(bills));
        bills.Bills[0].billDetails[0].billAccountDetails.map(function(x){
          let obj = {}
          obj.taxHeadCode = x.taxHeadCode;
          obj.currentDemand = x.amount
          temp.push(obj);
        })
        bills.Bills[0].billDetails.splice(0,1); //removed the zero obj
        temp.map(function(par){
          bills.Bills[0].billDetails.map(function(x){
             if(x.billAccountDetails.length>0)
             {
               x.billAccountDetails.map(function(billDtl){
                 if(par.taxHeadCode == billDtl.taxHeadCode)
                 {
                   if(par.arrears)
                   par.arrears = par.arrears + billDtl.amount; 
                   else
                   par.arrears=billDtl.amount; 
                   par.total = par.arrears + par.currentDemand
                   //console.log((par.taxHeadCode + "--" + par.arrears));
                 }
               })
             }
         })
        })
        // write from here
        //console.log(JSON.stringify(temp));
        bills.Bills[0].arrearDtl = temp;
        //console.log("bills--",JSON.stringify(bills));
        if (bills && bills.Bills && bills.Bills.length > 0) {
          var pdfResponse;
          var pdfkey = config.pdf.ptbill_pdf_template;
          tenantId = tenantId.split('.')[0];
          try {
            var billArray = { Bill: bills.Bills };
            pdfResponse = await create_pdf(
              tenantId,
              pdfkey,
              billArray,
              requestinfo
            );
          } catch (ex) {
            //console.log(ex.stack);
          //  if (ex.response && ex.response.data) console.log(ex.response.data);
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
          return renderError(res, "There is no bill for this id", 404);
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


router.post(
  "/ptreceipt",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var uuid = req.query.uuid;
    var requestinfo = req.body;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !uuid) {
      return renderError(
        res,
        "tenantId and uuid are mandatory to generate the ptreceipt",
        400
      );
    }
    try {
      try {
        resProperty = await search_property(uuid, tenantId, requestinfo);
      } catch (ex) {
        console.log(ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query details of the property", 500);
      }
      var properties = resProperty.data;
      if (
        properties &&
        properties.Properties &&
        properties.Properties.length > 0
      ) {
        var propertyid = properties.Properties[0].propertyId;
        var paymentresponse;
        try {
          paymentresponse = await search_payment(
            propertyid,
            tenantId,
            requestinfo
          );
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query payment for property`, 500);
        }
        var payments = paymentresponse.data;
        if (payments && payments.Payments && payments.Payments.length > 0) {
          var pdfResponse;
          var pdfkey = config.pdf.ptreceipt_pdf_template;
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
          return renderError(res, "There is no payment for this id", 404);
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

router.post(
  "/newpt-receipt",
  asyncMiddleware(async function (req, res, next) {
    var tenantId = req.query.tenantId;
    var propertyId = req.query.propertyId;
    var requestinfo = req.body;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !propertyId) {
      return renderError(
        res,
        "tenantId and propertyId are mandatory to generate the ptreceipt",
        400
      );
    }
    try {
      try {
        resProperty = await search_property_with_propnumber(propertyId, tenantId, requestinfo);
      } catch (ex) {
        console.log(ex.stack);
        if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to query details of the property", 500);
      }
      var properties = resProperty.data;
     // console.log("properties--",properties);
      if (
        properties &&
        properties.Properties &&
        properties.Properties.length > 0
      ) {
        var propertyid = properties.Properties[0].propertyId;
        var paymentresponse;
        try {
          paymentresponse = await search_payment(
            propertyid,
            tenantId,
            requestinfo
          );
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query payment for property`, 500);
        }
        var payments = paymentresponse.data;
        if (payments && payments.Payments && payments.Payments.length > 0) {
        var sortedObj = payments.Payments[0].paymentDetails[0].bill.billDetails;
        var compiledObjs = []
        var compArr = [];
        sortedObj.map(billDtl =>{
          billDtl.billAccountDetails.sort(sortTaxhead);
          billDtl.billAccountDetails.forEach(billobj =>{
             if(!compArr.includes(billobj.taxHeadCode))
             compArr.push(billobj.taxHeadCode);
          })
        })
        //console.log("compArr---"+compArr);
        compArr.forEach(taxhead=>{
        sortedObj.map(billDtl =>{
          billDtl.billAccountDetails.forEach(billobj =>{
             if(taxhead == billobj.taxHeadCode)
             {
               
              if(compiledObjs.filter(someobject => someobject.taxHead == billobj.taxHeadCode).length>0)
               {
                //console.log("in if-"+billobj.taxHeadCode);
                compiledObjs.filter(someobject => someobject.taxHead == billobj.taxHeadCode)
                .forEach(someobject => {
                  someobject.amount = someobject.amount + billobj.amount;
                  someobject.amountPaid = someobject.amountPaid + billobj.adjustedAmount;
                })
              }
              else{
                //console.log("in else-"+billobj.taxHeadCode);
                let obj  = {
                  taxHead : billobj.taxHeadCode,
                  amount : billobj.amount,
                  amountPaid : billobj.adjustedAmount
                }
                compiledObjs.push(obj);
              }
             }
          })
        })
      })
        //console.log("sorted obj---",JSON.stringify(compiledObjs));
        //sortedObj.sort(sortTaxhead);
      payments.Payments[0].paymentDetails[0].bill.receiptObj = compiledObjs;
          var pdfResponse;
          var pdfkey = config.pdf.newptreceipt_pdf_template;
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
          return renderError(res, "There is no payment for this id", 404);
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
