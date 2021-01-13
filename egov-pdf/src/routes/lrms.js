var express = require("express");
var router = express.Router();
var config = require("../config");
var {
  create_pdf,
} = require("../api");
const { asyncMiddleware } = require("../utils/asyncMiddleware");
function renderError(res, errorMessage, errorCode) {
  if (errorCode == undefined) errorCode = 500;
  res.status(errorCode).send({ errorMessage });
}


router.post(
    "/lrms-renewalCertificate",
    asyncMiddleware(async function (req, res, next) {
        var tenantId = req.query.tenantId;
        var requestinfo = req.body;
        var leaseApplication = requestinfo.leaseApplication;
        delete requestinfo.leaseApplication;
        if (requestinfo == undefined) {
          return renderError(res, "requestinfo can not be null", 400);
        }
        if (!tenantId ) {
          return renderError(
            res,
            "tenantId is mandatory to generate the LrmsRenewalCertificate",
            400
          );
        }
        console.log("req---",requestinfo);
        tenantId = tenantId.split('.')[0];
        var pdfResponse;
        var pdfkey = config.pdf.lrms_renewal_notice;
        try {
          pdfResponse = await create_pdf(
            tenantId,
            pdfkey,
            leaseApplication,
            requestinfo
          );
        } catch (ex) {
          //console.log(ex.stack);
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