// config.js
// const env = process.env.NODE_ENV; // 'dev' or 'test'

HOST = process.env.EGOV_HOST ;

if (!HOST) {
  console.log("You need to set the HOST variable");
  process.exit(1);
}

module.exports = {
  auth_token: process.env.AUTH_TOKEN,
  pdf: {
    epass_pdf_template: process.env.EPASS_TEMPLATE || "tlcertificate",
    tlcertificate_pdf_template: process.env.TL_CERTIFICATE || "tlcertificate",
    tlrenewalcertificate_pdf_template:
      process.env.TL_RENEWALCERTIFICATE || "tlrenewalcertificate",
    tlreceipt_pdf_template: process.env.TL_RECEIPT || "tradelicense-receipt",
    tl_appl_receipt_pdf_template: process.env.TL_APPL_RECEIPT || "tradelicense-appl-receipt",
    tlbill_pdf_template: process.env.TL_BILL || "tradelicense-bill",
    ptreceipt_pdf_template: process.env.PT_RECEIPT || "property-receipt",
    ptmutationcertificate_pdf_template:
      process.env.PT_MUTATION_CERTIFICATE || "ptmutationcertificate",
    ptbill_pdf_template: process.env.PT_BILL || "property-bill",
    consolidated_receipt_template:
      process.env.CONSOLIDATED_RECEIPT || "consolidatedreceipt",
    consolidated_bill_template:
      process.env.CONSOLIDATED_BILL || "consolidatedbill",
    mcollect_challan_template:
      process.env.MCOLLECT_CHALLAN || "mcollect-challan",
    mcollect_bill_template:
      process.env.MCOLLECT_BILL || "mcollect-bill",
    ws_estimate_template:
      process.env.WS_ESTIMATENOTICE || "ws-estimationnotice",
    sw_estimate_template:
      process.env.SW_ESTIMATENOTICE || "sw-estimationnotice",
    ws_sanction_template:
      process.env.WS_ESTIMATENOTICE || "ws-sanctionletter",
    sw_sanction_template:
      process.env.SW_ESTIMATENOTICE || "sw-sanctionletter",
    ws_estimate_template_hi:
      process.env.WS_ESTIMATENOTICE_HI || "ws-estimationnotice-hi",
    ws_sanction_template_hi:
      process.env.WS_ESTIMATENOTICE_HI || "ws-sanctionletter-hi",
    sw_estimate_template_hi:
      process.env.SW_ESTIMATENOTICE_HI || "sw-estimationnotice-hi",
    sw_sanction_template_hi:
      process.env.SW_ESTIMATENOTICE_HI || "sw-sanctionletter-hi",
    lrms_renewal_notice:
      process.env.LRMS_RENEWALNOTICE || "lrms-renewalextension",
    birth_certificate:
      process.env.BIRTH_CERTIFICATE || "birth-certificate"
  },
  app: {
    port: parseInt(process.env.APP_PORT) || 8080,
    host: HOST,
    contextPath: process.env.CONTEXT_PATH || "/egov-pdf",
  },
  host: {
    mdms: process.env.EGOV_MDMS_HOST || HOST,
    epass: process.env.EGOV_TLSERVICES_HOST || HOST,
    tl: process.env.EGOV_TRADELICENSESERVICES_HOST || HOST,
    pt: process.env.EGOV_PTSERVICES_HOST || HOST,
    pdf: process.env.EGOV_PDF_HOST || HOST,
    user: process.env.EGOV_USER_HOST || HOST,
    payments: process.env.EGOV_PAYMENTS_HOST || HOST,
    bill: process.env.EGOV_SEARCHER_HOST || HOST,
    workflow: process.env.EGOV_WORKFLOW_HOST || HOST,
    challan: process.env.EGOV_ECHALLAN_HOST || HOST,
    mcollectBilling: process.env.EGOV_BILLING_HOST || HOST,
    ws: process.env.EGOV_WS_SERVICE_HOST || HOST,
    sw: process.env.EGOV_SW_SERVICE_HOST || HOST,
    ws_calc:process.env.EGOV_WS_CALC_SERVICE_HOST || HOST,
    sw_calc:process.env.EGOV_SW_CALC_SERVICE_HOST || HOST,
  },
  paths: {
    pdf_create: "/pdf-service/v1/_create",
    epass_search: "/tl-services/v1/_search",
    tl_search: "/tl-services/v1/_search",
    pt_search: "/property-services/property/_search",
    user_search: "/user/_search",
    mdms_search: "/egov-mdms-service/v1/_search",
    download_url: "/download/epass",
    payment_search: "/collection-services/payments/_search",
    bill_search: "/egov-searcher/bill-genie/billswithaddranduser/_get",
    workflow_search: "/egov-workflow-v2/egov-wf/process/_search",
    mcollect_challan_search:"/echallan-services/eChallan/v1/_search",
    mcollect_bill:"/billing-service/bill/v2/_search",
    bill_genie_getBill:"/egov-searcher/bill-genie/mcollectbills/_get",
    ws_search:"/ws-services/wc/_search",
    estimate:"/ws-calculator/waterCalculator/_estimate",
    sw_search:"/sw-services/swc/_search",
    estimate_sw:"/sw-calculator/sewerageCalculator/_estimate",
    wf_bs_search:"/egov-workflow-v2/egov-wf/businessservice/_search"
  },
};