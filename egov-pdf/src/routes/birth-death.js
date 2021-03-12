var express = require("express");
var get = require('lodash.get');
var router = express.Router();
var config = require("../config");
var {
  create_pdf,
  search_mdms
} = require("../api");
const { asyncMiddleware } = require("../utils/asyncMiddleware");
function renderError(res, errorMessage, errorCode) {
  if (errorCode == undefined) errorCode = 500;
  res.status(errorCode).send({ errorMessage });
}


router.post(
    "/birth-certificate",
    asyncMiddleware(async function (req, res, next) {
        var tenant = req.query.tenantId;
        var requestinfo = req.body;
        var birthCertificate = null;
        delete requestinfo.leaseApplication;
        if (requestinfo == undefined) {
          return renderError(res, "requestinfo can not be null", 400);
        }
        if (!tenant ) {
          return renderError(
            res,
            "tenantId is mandatory to generate the Birth Certificate",
            400
          );
        }
        console.log("req---",requestinfo);
        let tenantId = tenant.split('.')[0];
        let mdmsBody = {
          MdmsCriteria: {
            tenantId: tenantId,
            moduleDetails: [
              { moduleName: "common-masters",
                   masterDetails: [
                      {
                        name:"bdTemplate",
                        filter: "[?(@.code == '"+tenant+"')]"
                      }
                    ] },
            ]
          }
        };
        var pdfkey = config.pdf.birth_certificate;
        try{
          let mdmsResp = await search_mdms(
            tenant,
            mdmsBody,
            requestinfo
          );
          console.log("mdmsResp---",mdmsResp.data.MdmsRes);
          const moduleName = mdmsBody.MdmsCriteria.moduleDetails[0].moduleName;
          let documents = get(
            mdmsResp.data.MdmsRes,
            `${moduleName}.bdTemplate`,
            []
          );
          pdfkey = documents[0].template;
        } catch (ex) {
          console.log("error===",ex.stack);  
        }
        var pdfResponse;
        console.log("pdfkey---",pdfkey);
        try {
          pdfResponse = await create_pdf(
            tenantId,
            pdfkey,
            requestinfo,
            requestinfo
          );
        } catch (ex) {
          console.log(ex.stack);
          //if (ex.response && ex.response.data) console.log(ex.response.data);
          return renderError(res, "Failed to generate PDF for payment", 500);
        }

        var filename = `${pdfkey}_${new Date().getTime()}`;

        //pdfData = pdfResponse.data.read();
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename=${filename}.pdf`,
        });
        pdfResponse.data.pipe(res);
    })
);


router.post(
  "/death-certificate",
  asyncMiddleware(async function (req, res, next) {
      var tenant = req.query.tenantId;
      var requestinfo = req.body;
      var birthCertificate = null;
      delete requestinfo.leaseApplication;
      if (requestinfo == undefined) {
        return renderError(res, "requestinfo can not be null", 400);
      }
      if (!tenant ) {
        return renderError(
          res,
          "tenantId is mandatory to generate the Birth Certificate",
          400
        );
      }
      console.log("req---",requestinfo);
      let tenantId = tenant.split('.')[0];
      let mdmsBody = {
        MdmsCriteria: {
          tenantId: tenantId,
          moduleDetails: [
            { moduleName: "common-masters",
                 masterDetails: [
                    {
                      name:"bdTemplate",
                      filter: "[?(@.code == '"+tenant+"')]"
                    }
                  ] },
          ]
        }
      };
      var pdfkey = config.pdf.birth_certificate;
      try{
        let mdmsResp = await search_mdms(
          tenant,
          mdmsBody,
          requestinfo
        );
        console.log("mdmsResp---",mdmsResp.data.MdmsRes);
        const moduleName = mdmsBody.MdmsCriteria.moduleDetails[0].moduleName;
        let documents = get(
          mdmsResp.data.MdmsRes,
          `${moduleName}.bdTemplate`,
          []
        );
        pdfkey = documents[0].template;
      } catch (ex) {
        console.log("error===",ex.stack);  
      }
      var pdfResponse;
      console.log("pdfkey---",pdfkey);
      try {
        pdfResponse = await create_pdf(
          tenantId,
          pdfkey,
          requestinfo,
          requestinfo
        );
      } catch (ex) {
        console.log(ex.stack);
        //if (ex.response && ex.response.data) console.log(ex.response.data);
        return renderError(res, "Failed to generate PDF for payment", 500);
      }

      var filename = `${pdfkey}_${new Date().getTime()}`;

      //pdfData = pdfResponse.data.read();
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${filename}.pdf`,
      });
      pdfResponse.data.pipe(res);
  })
);









module.exports = router;