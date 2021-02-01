package org.egov.win.service;

import java.io.StringWriter;
import java.util.List;
import java.util.Map;

import org.apache.velocity.Template;
import org.apache.velocity.VelocityContext;
import org.egov.win.model.Body;
import org.egov.win.model.Email;
import org.egov.win.model.Firenoc;
import org.egov.win.model.LAMS;
import org.egov.win.model.MiscCollections;
import org.egov.win.model.PGR;
import org.egov.win.model.PT;
import org.egov.win.model.StateWide;
import org.egov.win.model.TL;
import org.egov.win.model.TotalCollections;
import org.egov.win.model.WaterAndSewerage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class EmailService {

	@Autowired
	private CronService service;

	public String formatEmail(Email email) {
		Template t = service.getVelocityTemplate();
		VelocityContext context = new VelocityContext();
		buildEmailBody(email.getBodyContent(), context);
		StringWriter writer = new StringWriter(10000);
		t.merge(context, writer);

		return writer.toString();
	}

	private void buildEmailBody(Body body, VelocityContext context) {
		enrichHeaderData(body.getHeader(), context);
		if (null != body.getStateWide())
			enrichStateWideData(body.getStateWide(), context);
		if (null != body.getPgr())
			enrichPGRData(body.getPgr(), context);
		if (null != body.getPt())
			enrichPTData(body.getPt(), context);
		if (null != body.getTl())
			enrichTLData(body.getTl(), context);
		if (null != body.getWaterAndSewerage())
			enrichWSData(body.getWaterAndSewerage(), context);
		if (null != body.getMiscCollections())
			enrichMCData(body.getMiscCollections(), context);
		if(null !=body.getFirenoc())
			enrichFirenocData(body.getFirenoc(), context);
		if(null !=body.getTotalRevenuecollected())
			enrichTotalRevenueData(body.getTotalRevenuecollected(), context);
		if(null!=body.getLams())
			enrichLAMSData(body.getLams(), context);
	}

	private void enrichHeaderData(List<Map<String, Object>> header, VelocityContext context) {
		fillData(header, context);
	}

	private void enrichStateWideData(StateWide stateWide, VelocityContext context) {
		fillData(stateWide.getNoOfCitizensResgistered(), context);
		fillData(stateWide.getRevenueCollected(), context);
		fillData(stateWide.getServicesApplied(), context);
		fillData(stateWide.getUlbCovered(), context);
	}

	private void enrichPGRData(PGR pgr, VelocityContext context) {
		fillData(pgr.getRedressal(), context);
		fillData(pgr.getTotalComplaints(), context);
		fillData(pgr.getUlbCovered(), context);
		//fillData(pgr.getChannelBreakup().getIvr(), context);
		//fillData(pgr.getChannelBreakup().getMobileApp(), context);
		//fillData(pgr.getChannelBreakup().getWebApp(), context);
	}

	private void enrichPTData(PT pt, VelocityContext context) {
		fillData(pt.getNoOfProperties(), context);
		fillData(pt.getRevenueCollected(), context);
		fillData(pt.getUlbCovered(), context);
	}
	
	private void enrichFirenocData(Firenoc firenoc, VelocityContext context) {
		fillData(firenoc.getCertificatesIssued(), context);
		fillData(firenoc.getRevenueCollected(), context);
		fillData(firenoc.getUlbCovered(), context);
	}	

	private void enrichTLData(TL tl, VelocityContext context) {
		fillData(tl.getLicenseIssued(), context);
		fillData(tl.getUlbCovered(), context);
		fillData(tl.getRevenueCollected(), context);
		fillData(tl.getLicenseTotal(), context);
	}

	private void enrichWSData(WaterAndSewerage ws, VelocityContext context) {
		fillData(ws.getServiceApplied(), context);
		fillData(ws.getRevenueCollected(), context);
		fillData(ws.getUlbCovered(), context);
	}
	
	private void enrichMCData(MiscCollections mc, VelocityContext context) {
		fillData(mc.getUlbCovered(), context);
		fillData(mc.getReceiptsGenerated(), context);
		fillData(mc.getRevenueCollected(), context);
	}

	private void enrichTotalRevenueData(TotalCollections totalCollections, VelocityContext context) {
		fillData(totalCollections.getRevenueCollected(), context);
		fillData(totalCollections.getServicesAvailed(), context);
		fillData(totalCollections.getCitizensRegistered(), context);
	}
	
	private void enrichLAMSData(LAMS lams, VelocityContext context) {
		fillData(lams.getUlbCovered(), context);
		fillData(lams.getLeaseTotal(), context);
		fillData(lams.getLeaseApproved(), context);
	}
	private void fillData(List<Map<String, Object>> dataFromQuery, VelocityContext context) {
		dataFromQuery.forEach(record -> {
			for (String key : record.keySet()) {
				context.put(key, record.get(key));
			}
		});
	}

}