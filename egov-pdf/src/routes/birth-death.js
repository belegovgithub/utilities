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
    "/birth-certificate",
    asyncMiddleware(async function (req, res, next) {
        var tenantId = req.query.tenantId;
        var requestinfo = req.body;
        var birthCertificate = requestinfo.BirthCertificate;
        delete requestinfo.leaseApplication;
        if (requestinfo == undefined) {
          return renderError(res, "requestinfo can not be null", 400);
        }
        if (!tenantId ) {
          return renderError(
            res,
            "tenantId is mandatory to generate the Birth Certificate",
            400
          );
        }
        console.log("req---",requestinfo);
        tenantId = tenantId.split('.')[0];
        var pdfResponse;
        var pdfkey = config.pdf.birth_certificate;
        try {
          pdfResponse = await create_pdf(
            tenantId,
            pdfkey,
            requestinfo,
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
    })
);









module.exports = router;