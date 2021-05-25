var express = require("express");
var router = express.Router();
var url = require("url");
var config = require("../config");

var {
  search_property,
  search_bill,
  search_demand,
  search_payment,
  create_pdf,
  search_workflow,
  search_property_with_propnumber,
  sortTaxhead
} = require("../api");

const { asyncMiddleware } = require("../utils/asyncMiddleware");
const { count } = require("console");

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
  console.log("request--",req);
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
        // can search multiple property ids
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
        var BillData = [];
        for(let i=0;i<properties.Properties.length;i++) // Loop for multiple property ids
        {
        var propertyid = properties.Properties[i].propertyId;
        console.log("property id---"+propertyid)
        var billresponse;
        try {
          billresponse = await search_bill(propertyid, tenantId, requestinfo); // search bill for the corresponding property id
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query bills for property`, 500);
        }
        var bills = billresponse.data;
        //console.log("bills orig--",JSON.stringify(bills));
        if( bills &&
          bills.Bills &&
          bills.Bills.length > 0)
          {
        var format = /[ `!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
        if(format.test(properties.Properties[i].usageCategory)) // check for . in usage category and replace it with _
        properties.Properties[i].usageCategory.replace(/./g,"_");
        bills.Bills[0].usageCategory = properties.Properties[i].usageCategory;
        bills.Bills[0].oldPropertyId = properties.Properties[i].oldPropertyId;
        if(properties.Properties[i].units)
        bills.Bills[0].arv = properties.Properties[i].units[0].arv;

        var sortedObj = bills.Bills[0].billDetails;
        var compArr = [];
        sortedObj.map(billDtl =>{
          billDtl.billAccountDetails.sort(sortTaxhead); // Sort taxheads based on order for current year bill
          billDtl.billAccountDetails.forEach(billobj =>{
             if(!compArr.includes(billobj.taxHeadCode))
             compArr.push(billobj.taxHeadCode);
          })
        })
        console.log("compArr---"+compArr);
        
        var demandresponse;
        try {
          demandresponse = await search_demand(propertyid, tenantId, requestinfo); // Search demand details for the corresponding property id
        } catch (ex) {
          console.log(ex.stack);
          if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, `Failed to query bills for property`, 500);
        }
        var demand = demandresponse.data;
       // console.log("demand orig--",JSON.stringify(demand));
        if(demand &&
          demand.Demands &&
          demand.Demands.length > 0)
        {
        var demandArr = [];
        var currentDemandObj = demand.Demands[demand.Demands.length-1]; //get current year demand object
        //console.log("currentDemandObj--",JSON.stringify(currentDemandObj));
        var advanceDemand = 0;// if advance is availabe for previous year
        var previousDemand=0; // to store the demand notice charge for previous year
        var advanceCarryForward = 0; // if advance is availabe for current year
        var totalPaid = 0; //total amount paid
        var totalArrear = 0; // total arrear amount
        var totalCurrent = 0; // total current amount
        if(!currentDemandObj.isPaymentCompleted) // if payment is still pending
        {
          compArr.forEach(taxhead=>{
          currentDemandObj.demandDetails.map(function(x){
            if(taxhead == x.taxHeadMasterCode)
            {
              if(x.taxHeadMasterCode == 'PT_ADVANCE_CARRYFORWARD') //if advance amount available
              {
                advanceCarryForward = x.taxAmount;
              }
              
              else
              {
              let obj = {}
              obj.taxHeadCode = x.taxHeadMasterCode; 
              obj.currentDemand = x.taxAmount;
              obj.arrears = 0;
              obj.total =obj.arrears + obj.currentDemand;
              //demandArr.push(obj);       
              // console.log("taxhead code--"+obj.taxHeadCode+" vlaue"+obj.currentDemand 
               var taxheadpresent=false;
                for(let i=0;i<demandArr.length;i++)
                {
                  someobject=demandArr[i];
                  if(someobject.taxHeadCode == x.taxHeadMasterCode)
                  {
                    someobject.total=someobject.total+x.taxAmount;
                    someobject.currentDemand=someobject.currentDemand+x.taxAmount;
                    taxheadpresent=true;
                 }
                  
                }
                if(taxheadpresent==false)
                {
                  demandArr.push(obj);
                }
              //demandArr.push(obj);
              //console.log("demandArr--"+JSON.stringify(demandArr));
              totalPaid= totalPaid+x.collectionAmount; //Total amount paid
              totalCurrent = totalCurrent + x.taxAmount; // total amount paid for current demand
            }
          }
        })
      })
      }
     //console.log("advanceCarryforward--"+advanceCarryForward);
      demand.Demands.splice(demand.Demands.length-1,1); //splice the demand object
      //console.log("demand after--",JSON.stringify(demand));
      demandArr.map(function(par){ //loop over current demand object
        if(demand.Demands.length>0)
        {
        demand.Demands.map(function(x){
           if(x.demandDetails.length>0)
           {
             x.demandDetails.map(function(billDtl){
              //temp code
              if(demandArr.filter(someobject => someobject.taxHeadCode == billDtl.taxHeadMasterCode).length>0)
              {
                if(par.taxHeadCode == billDtl.taxHeadMasterCode)
               {
                  //console.log("billDtl--"+JSON.stringify(billDtl));
                  par.arrears = par.arrears + billDtl.taxAmount; 
                  par.total = par.arrears + par.currentDemand
                  totalPaid = totalPaid + billDtl.collectionAmount;
                  totalArrear = totalArrear + billDtl.taxAmount
                }
                console.log("demandArr--"+JSON.stringify(demandArr))
              }
              else{
                if(billDtl.taxHeadMasterCode == "PT_ADVANCE_CARRYFORWARD" && advanceDemand ==0)
                advanceDemand = advanceDemand + billDtl.taxAmount;
                if(billDtl.taxHeadMasterCode == "PT_DEMANDNOTICE_CHARGE" && previousDemand ==0)
                previousDemand = previousDemand + billDtl.taxAmount;
              }
             })
           }
       })
      }
      })
      
      //console.log("demandArr--"+JSON.stringify(demandArr))
      if(previousDemand >0)
      {
        let obj={};
        obj.taxHeadCode = "PT_DEMANDNOTICE_CHARGE"; 
        obj.currentDemand = 0;
        obj.arrears = previousDemand;
        obj.total = obj.arrears + obj.currentDemand;
        demandArr.push(obj);
        totalArrear=totalArrear+previousDemand;

      }
   //  console.log("demandArr--"+JSON.stringify(demandArr));
     // console.log("totalPaid--"+totalPaid);
    


       /* bills.Bills[0].billDetails.sort(function(x,y){
          return y.fromPeriod - x.fromPeriod
        })
        bills.Bills[0].billDetails.map(function(x){
           x.billAccountDetails.sort(function(x,y){
              return x.order - y.order
           })
        })
        //console.log("bills sorted--",JSON.stringify(bills));
        let temp =[];
        let advanceCarryForward = null;
       // console.log(JSON.stringify(bills));
        bills.Bills[0].billDetails[0].billAccountDetails.map(function(x){
          if(x.taxHeadCode == 'PT_ADVANCE_CARRYFORWARD')
          {
            advanceCarryForward = x.amount;
          }
          else
          {
          let obj = {}
          obj.taxHeadCode = x.taxHeadCode;
          obj.currentDemand = x.amount
          temp.push(obj);
          }
        })
        bills.Bills[0].billDetails.splice(0,1); //removed the zero obj
        temp.map(function(par){
          bills.Bills[0].billDetails.map(function(x){
             if(x.billAccountDetails.length>0)
             {
               x.billAccountDetails.map(function(billDtl){
                 if(billDtl.taxHeadCode == "PT_ADVANCE_CARRYFORWARD")
                 advanceCarryForward = billDtl.amount
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
        })*/
        // write from here
        //console.log("advanceCarryForward--",advanceCarryForward);
        bills.Bills[0].arrearDtl = demandArr;
        
        bills.Bills[0].advanceCarryforward = Math.abs(advanceCarryForward).toFixed(2);
        bills.Bills[0].totalPaid = (totalPaid + advanceDemand + previousDemand).toFixed(2);
        bills.Bills[0].totalArrear = totalArrear.toFixed(2);
        bills.Bills[0].totalCurrent = totalCurrent.toFixed(2);
        bills.Bills[0].adjustedAmount = totalPaid>= (totalArrear+totalCurrent).toFixed(2) ? (totalArrear+totalCurrent).toFixed(2) : totalPaid.toFixed(2);
         bills.Bills[0].payableAmount = bills.Bills[0].adjustedAmount>= (totalArrear+totalCurrent).toFixed(2) ? 0 :(((totalArrear+totalCurrent) - bills.Bills[0].adjustedAmount) ).toFixed(2);
      //  bills.Bills[0].payableAmount = bills.Bills[0].totalAmount - bills.Bills[0].advanceAmount;
        //console.log("bills--",JSON.stringify(bills));
        BillData.push(...bills.Bills);
      }
        }
      }
      //console.log("bills--",JSON.stringify(BillData));
        if (BillData && BillData.length > 0) {
          var pdfResponse;
          var pdfkey = config.pdf.ptbill_pdf_template;
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
    var receiptNo = req.query.receiptNo;
    if (requestinfo == undefined) {
      return renderError(res, "requestinfo can not be null", 400);
    }
    if (!tenantId || !propertyId || !receiptNo) {
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
      //console.log("properties--",properties);
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
        //console.log("payments--",JSON.stringify(payments));
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
       
        //sortedObj.sort(sortTaxhead);
        compiledObjs.map(receiptObj =>{
          receiptObj.billNo = payments.Payments[0].paymentDetails[0].bill.billNumber;
          receiptObj.billDate = payments.Payments[0].paymentDetails[0].bill.billDate;
        });
        // console.log("sorted obj---",JSON.stringify(compiledObjs));
      payments.Payments[0].paymentDetails[0].bill.receiptObj = compiledObjs;
          var pdfResponse;
          var pdfkey = config.pdf.newptreceipt_pdf_template;
          tenantId = tenantId.split('.')[0];
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
