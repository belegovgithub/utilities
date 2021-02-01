package org.egov.win.service;

import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.velocity.Template;
import org.apache.velocity.app.VelocityEngine;
import org.apache.velocity.runtime.RuntimeConstants;
import org.apache.velocity.runtime.resource.loader.ClasspathResourceLoader;
import org.egov.win.config.PropertyManager;
import org.egov.win.model.Body;
import org.egov.win.model.Email;
import org.egov.win.model.EmailRequest;
import org.egov.win.model.Firenoc;
import org.egov.win.model.LAMS;
import org.egov.win.model.MiscCollections;
import org.egov.win.model.PGR;
import org.egov.win.model.PGRChannelBreakup;
import org.egov.win.model.PT;
import org.egov.win.model.StateWide;
import org.egov.win.model.TL;
import org.egov.win.model.TotalCollections;
import org.egov.win.model.WaterAndSewerage;
import org.egov.win.producer.Producer;
import org.egov.win.utils.CronConstants;
import org.egov.win.utils.CronUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class CronService {

	@Autowired
	private EmailService emailService;
	
	@Autowired
	private CronUtils utils;
	
	@Autowired
	private ExternalAPIService externalAPIService;

	@Autowired
	private Producer producer;
	
	@Autowired
	private PropertyManager propertyManager;

	@Value("${egov.core.notification.email.topic}")
	private String emailTopic;

	@Value("${egov.impact.emailer.interval.in.secs}")
	private Long timeInterval;

	@Value("${egov.impact.emailer.email.to.address}")
	private String toAddress;

	@Value("${egov.impact.emailer.email.subject}")
	private String subject;
	
	private Map<String, Object> totalrevcollectedPerWeek = new HashMap<String, Object>();
	private Map<String, Object> totalServicesAvailedPerWeek = new HashMap<String, Object>();
	private Map<String, Object> totalCitizensRegisteredPerWeek = new HashMap<String, Object>();

	public void fetchData() {
		try {
			Email email = getDataFromDb();
			String content = emailService.formatEmail(email);
			log.info("content: "+content);
			send(email, content);
		} catch (Exception e) {
			log.info("Email will not be sent, ERROR: ", e);
		}

	}

	private Email getDataFromDb() {
		Body body = new Body();
		//List<Map<String, Object>> wsData = externalAPIService.getWSData();
		//if(CollectionUtils.isEmpty(wsData))
			//throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from WS module");
		enrichHeadersOfTheTable(body);
		//enrichBodyWithStateWideData(body, wsData);
		enrichBodyWithPGRData(body);
		//enrichBodyWithPTData(body);
		enrichBodyWithTLData(body);
		enrichBodyWithMiscCollData(body);
		//enrichBodyWithWSData(body, wsData);
		//enrichBodyWithFirenocData(body);
		enrichBodyWithLeaseData(body);
		return Email.builder().bodyContent(body).isHTML(true).build();
	}

	private void enrichHeadersOfTheTable(Body body) {
		String prefix = "Week";
		Integer noOfWeeks = 6;
		List<Map<String, Object>> header = new ArrayList<>();
		for (int week = 0; week < noOfWeeks; week++) {
			Map<String, Object> date = new HashMap<>();
			long miiliSecsperDay = 86400000l; // 24*60*60*1000 ;
			long currentTime = System.currentTimeMillis();
			if(propertyManager.isWeekly())
			{
				long miiliSecInWeek = (long) 7*miiliSecsperDay;

				long sundayNightOffset = ((long)propertyManager.getWeekendOffset()*miiliSecsperDay - (18000000l) - (1800000l) -(1000l)); //5*60*60*1000 - 30*60*1000 - 1000 millisecs// GMT Hours 05:30 - 1 sec
				long aheadOfThursday = currentTime % miiliSecInWeek;
				long toAddweekend = 0l;
				if(aheadOfThursday < sundayNightOffset)
					toAddweekend = sundayNightOffset - aheadOfThursday;
				else
					toAddweekend = miiliSecInWeek - (aheadOfThursday - sundayNightOffset) ;


				date.put(prefix + week,
						utils.getDayAndMonth(currentTime+toAddweekend-(miiliSecInWeek*week)));
				date.put("Weekhdr","Since 6 weeks");
			}
			else
			{
				date.put(prefix + week,
						utils.getDayAndMonth(miiliSecsperDay + miiliSecsperDay * (currentTime / miiliSecsperDay) - (18000000l) - (1800000l) - (miiliSecsperDay*week)));
				date.put("Weekhdr","Since 6 days");
			}
			
			header.add(date);
		}
		body.setHeader(header);
	}

	private void enrichBodyWithStateWideData(Body body, List<Map<String, Object>> wsData) {
		List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_SW);
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> revenueCollected = new ArrayList<>();
		List<Map<String, Object>> servicesApplied = new ArrayList<>();
		List<Map<String, Object>> noOfCitizensResgistered = new ArrayList<>();
		Map<String, Object> map = utils.getWeekWiseRevenue(wsData);
		for (Map<String, Object> record : data) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			Map<String, Object> revenueCollectedPerWeek = new HashMap<>();
			Map<String, Object> servicesAppliedPerWeek = new HashMap<>();
			Map<String, Object> noOfCitizensResgisteredPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			Integer wsIndex = 0;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "ulbc", record.get("ulbcovered")); //ws not added because we need a union logic.
					revenueCollectedPerWeek.put("w" + week + "revcoll", 
							(new BigDecimal(record.get("revenuecollected").toString()).add(new BigDecimal(((Map) (map.get(prefix + week))).get("revenueCollected").toString()))));
					servicesAppliedPerWeek.put("w" + week + "serapp", 
							(new BigDecimal(record.get("servicesapplied").toString()).add(new BigDecimal(((Map) (map.get(prefix + week))).get("servicesApplied").toString()))));
					noOfCitizensResgisteredPerWeek.put("w" + week + "citreg", record.get("noofusersregistered"));
					wsIndex++;
				}
			}					
			ulbCovered.add(ulbCoveredPerWeek);
			revenueCollected.add(revenueCollectedPerWeek);
			servicesApplied.add(servicesAppliedPerWeek);
			noOfCitizensResgistered.add(noOfCitizensResgisteredPerWeek);
		}

		StateWide stateWide = StateWide.builder().noOfCitizensResgistered(noOfCitizensResgistered)
				.revenueCollected(revenueCollected).servicesApplied(servicesApplied).ulbCovered(ulbCovered).build();
		body.setStateWide(stateWide);		
	}

	private void enrichBodyWithPGRData(Body body) {
		//List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_PGR);
		List<Map<String, Object>> data = externalAPIService.getPGRReportData();
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> totalComplaints = new ArrayList<>();
		List<Map<String, Object>> redressal = new ArrayList<>();
		for (Map<String, Object> record : data) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			Map<String, Object> totalComplaintsPerWeek = new HashMap<>();
			Map<String, Object> redressalPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "pgrulbc", record.get("ulbcovered"));
					totalComplaintsPerWeek.put("w" + week + "pgrtcmp", record.get("totalcomplaints"));
					redressalPerWeek.put("w" + week + "pgrredd", record.get("redressal"));
					totalServicesAvailedPerWeek.put("w" + week + "totalservicesavailed", record.get("totalcomplaints"));
				}
			}
			ulbCovered.add(ulbCoveredPerWeek);
			totalComplaints.add(totalComplaintsPerWeek);
			redressal.add(redressalPerWeek);
		}
		PGR pgr = PGR.builder().redressal(redressal).totalComplaints(totalComplaints).ulbCovered(ulbCovered).build();
		//enrichBodyWithPGRChannelData(body, pgr);
		body.setPgr(pgr);
	}

	private void enrichBodyWithPGRChannelData(Body body, PGR pgr) {
		List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_PGR_CHANNEL);
		List<Map<String, Object>> ivr = new ArrayList<>();
		List<Map<String, Object>> mobiileApp = new ArrayList<>();
		List<Map<String, Object>> webApp = new ArrayList<>();
		for (Map<String, Object> record : data) {
			Map<String, Object> ivrPerWeek = new HashMap<>();
			Map<String, Object> mobileAppPerWeek = new HashMap<>();
			Map<String, Object> webAppPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ivrPerWeek.put("w" + week + "pgrchnlivr", record.get("ivr"));
					mobileAppPerWeek.put("w" + week + "pgrchnlmapp", record.get("mobileapp"));
					webAppPerWeek.put("w" + week + "pgrchnlweb", record.get("webapp"));
				}
			}
			ivr.add(ivrPerWeek);
			mobiileApp.add(mobileAppPerWeek);
			webApp.add(webAppPerWeek);
		}

		PGRChannelBreakup channel = PGRChannelBreakup.builder().ivr(ivr).mobileApp(mobiileApp).webApp(webApp).build();
		pgr.setChannelBreakup(channel);
	}

	private void enrichBodyWithPTData(Body body) {
		List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_PT);
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> revenueCollected = new ArrayList<>();
		List<Map<String, Object>> noOfProperties = new ArrayList<>();
		for (Map<String, Object> record : data) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			Map<String, Object> revenueCollectedPerWeek = new HashMap<>();
			Map<String, Object> noOfPropertiesPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "ptulbc", record.get("ulbcovered"));
					revenueCollectedPerWeek.put("w" + week + "ptrevcoll", record.get("revenuecollected"));
					noOfPropertiesPerWeek.put("w" + week + "ptnoofprp", record.get("noofpropertiescreated"));
				}
			}
			ulbCovered.add(ulbCoveredPerWeek);
			revenueCollected.add(revenueCollectedPerWeek);
			noOfProperties.add(noOfPropertiesPerWeek);
		}

		PT pt = PT.builder().noOfProperties(noOfProperties).ulbCovered(ulbCovered).revenueCollected(revenueCollected)
				.build();
		body.setPt(pt);
	}

	private void enrichBodyWithTLData(Body body) {
		//List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_TL);
		List<Map<String, Object>> data = externalAPIService.getTLAmountReportData();
		List<Map<String, Object>> dataLicence = externalAPIService.getTLLicenceReportData();
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> ulbAplCovered = new ArrayList<>();
		List<Map<String, Object>> licenseIssued = new ArrayList<>();
		List<Map<String, Object>> licenseTotal = new ArrayList<>();
		List<Map<String, Object>> revenueCollected= new ArrayList<>();
		for (Map<String, Object> record : data) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			Map<String,Object> revenueCollectedPerWeek=new HashMap<> ();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "tlulbc", record.get("ulbcovered"));
					revenueCollectedPerWeek.put("w" + week + "tlrevcoll", record.get("revenuecollected"));
					totalrevcollectedPerWeek.put("w" + week + "totalrevcoll", record.get("revenuecollected"));
				}
			}
			
			ulbCovered.add(ulbCoveredPerWeek);
			revenueCollected.add(revenueCollectedPerWeek);
		}
		
		for (Map<String, Object> record : dataLicence) {
			Map<String, Object> licenseIssuedPerWeek = new HashMap<>();
			Map<String, Object> licenseTotalPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					licenseIssuedPerWeek.put("w" + week + "tllicissued", record.get("licenseissued"));
					licenseIssuedPerWeek.put("w" + week + "tlaplulbc", record.get("ulbaplcovered"));
					licenseTotalPerWeek.put("w" + week + "tllictotal", record.get("licensetotal"));
					licenseIssuedPerWeek.put("w" + week + "tlaplissues", record.get("licenseaplissued"));
					totalServicesAvailedPerWeek.put("w" + week + "totalservicesavailed",
							(Integer) totalServicesAvailedPerWeek.get("w" + week + "totalservicesavailed") +
							(Integer) record.get("licensetotal"));
				}
			}
			licenseIssued.add(licenseIssuedPerWeek);
			licenseTotal.add(licenseTotalPerWeek);
		}

		TL tl = TL.builder().ulbCovered(ulbCovered).licenseIssued(licenseIssued).licenseTotal(licenseTotal).revenueCollected(revenueCollected).build();
		body.setTl(tl);
	}
	
	private void enrichBodyWithFirenocData(Body body) {
		List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_FIRENOC);
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> certificatesIssued = new ArrayList<>();
		List<Map<String, Object>> revenueCollected= new ArrayList<>();
		for (Map<String, Object> record : data) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			Map<String, Object> certificatesIssuedPerWeek = new HashMap<>();
			Map<String,Object> revenueCollectedPerWeek=new HashMap<> ();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "fnulbc", record.get("ulbcovered"));
					certificatesIssuedPerWeek.put("w" + week + "fncertissued", record.get("certificatesissued"));
					revenueCollectedPerWeek.put("w" + week + "fnrevcoll", record.get("revenuecollected"));
					
				}
			}
			ulbCovered.add(ulbCoveredPerWeek);
			certificatesIssued.add(certificatesIssuedPerWeek);
			revenueCollected.add(revenueCollectedPerWeek);
		}

		Firenoc firenoc = Firenoc.builder().ulbCovered(ulbCovered).certificatesIssued(certificatesIssued).revenueCollected(revenueCollected).build();
		body.setFirenoc(firenoc);
	}
	
	private void enrichBodyWithWSData(Body body, List<Map<String, Object>> data) {
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> revenueCollected = new ArrayList<>();
		List<Map<String, Object>> servicesApplied = new ArrayList<>();
		Integer week = 0;
		for (Map<String, Object> record : data) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			Map<String, Object> revenueCollectedPerWeek = new HashMap<>();
			Map<String, Object> servicesAppliedPerWeek = new HashMap<>();
			ulbCoveredPerWeek.put("w" + week + "wsulbc", record.get("ulbsCovered"));
			revenueCollectedPerWeek.put("w" + week + "wsrevcoll", record.get("revenueCollected"));
			servicesAppliedPerWeek.put("w" + week + "wsserapp", record.get("servicesApplied"));
			ulbCovered.add(ulbCoveredPerWeek);
			revenueCollected.add(revenueCollectedPerWeek);
			servicesApplied.add(servicesAppliedPerWeek);
			
			week++;
		}

		WaterAndSewerage waterAndSewerage = WaterAndSewerage.builder()
				.revenueCollected(revenueCollected).serviceApplied(servicesApplied).ulbCovered(ulbCovered).build();
		body.setWaterAndSewerage(waterAndSewerage);
	
	}
	
	
	private void enrichBodyWithMiscCollData(Body body) {
		//List<Map<String, Object>> data = externalAPIService.getRainmakerData(CronConstants.SEARCHER_MC);
		List<Map<String, Object>> data = externalAPIService.getMiscReportData();
		List<Map<String, Object>> receiptsGenerated = new ArrayList<>();
		List<Map<String, Object>> revenueCollected = new ArrayList<>();
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> totalRevenueCollected = new ArrayList<>();
		List<Map<String, Object>> totalServicesAvailed = new ArrayList<>();
		DecimalFormat df = new DecimalFormat("#.##");
		for (Map<String, Object> record : data) {
			Map<String, Object> receiptsGeneratedPerWeek = new HashMap<>();
			Map<String, Object> revenueCollectedPerWeek = new HashMap<>();
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "mculbc", record.get("ulb"));
					receiptsGeneratedPerWeek.put("w" + week + "mcrecgen", record.get("receiptscreated"));
					revenueCollectedPerWeek.put("w" + week + "mcrevcoll", record.get("revenuecollected"));
					totalrevcollectedPerWeek.put("w" + week + "totalrevcoll",df.format(
							Float.parseFloat((String) totalrevcollectedPerWeek.get("w" + week + "totalrevcoll")) +
							Float.parseFloat((String)  record.get("revenuecollected"))));
					totalServicesAvailedPerWeek.put("w" + week + "totalservicesavailed",
							(Integer) totalServicesAvailedPerWeek.get("w" + week + "totalservicesavailed") +
							(Integer) record.get("receiptscreated"));
				}
			}
			
			receiptsGenerated.add(receiptsGeneratedPerWeek);
			revenueCollected.add(revenueCollectedPerWeek);
			ulbCovered.add(ulbCoveredPerWeek);
			totalRevenueCollected.add(totalrevcollectedPerWeek);
			totalServicesAvailed.add(totalServicesAvailedPerWeek);
		}
		List<Map<String, Object>> dataCitizens = externalAPIService.getRainmakerData(propertyManager.isWeekly()?CronConstants.SEARCHER_CITIZEN_REGD:CronConstants.SEARCHER_CITIZEN_REGD_DAILY);
		List<Map<String, Object>> totalCitizensRegistered = new ArrayList<>();
		for (Map<String, Object> record : dataCitizens) {
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					totalCitizensRegisteredPerWeek.put("w" + week + "totalcitizensregistered",(int)Math.round( (Double)record.get("count")));
				}
			}
			totalCitizensRegistered.add(totalCitizensRegisteredPerWeek);
		}
		
		MiscCollections miscCollections = MiscCollections.builder().receiptsGenerated(receiptsGenerated).revenueCollected(revenueCollected).ulbCovered(ulbCovered).build();
		body.setMiscCollections(miscCollections);
		
		TotalCollections totalCollections = TotalCollections.builder().revenueCollected(totalRevenueCollected).
				servicesAvailed(totalServicesAvailed).citizensRegistered(totalCitizensRegistered).build();
		body.setTotalRevenuecollected(totalCollections);
	}

		

	private void send(Email email, String content) {
		String[] addresses = toAddress.split(",");
		Set<String> emailTo = new HashSet<String>();
		for (String address : Arrays.asList(addresses)) {
			emailTo.add(address);
		}
		email.setEmailTo(emailTo);
		email.setSubject(subject);
		email.setBody(content);
		EmailRequest request = EmailRequest.builder().email(email).build();
		log.info("sending "+email.getBody());
		producer.push(emailTopic, request);
	}

	public Template getVelocityTemplate() {
		VelocityEngine ve = new VelocityEngine();
		ve.setProperty(RuntimeConstants.RESOURCE_LOADER, "classpath");
		ve.setProperty("classpath.resource.loader.class", ClasspathResourceLoader.class.getName());
		ve.init();
		Template t = ve.getTemplate("velocity/weeklyimpactflasher.vm");
		return t;
	}

	private void enrichBodyWithLeaseData(Body body) {
		List<Map<String, Object>> dataUlb = externalAPIService.getLeaseULBData();
		List<Map<String, Object>> dataLease = externalAPIService.getLeaseApplData();
		List<Map<String, Object>> ulbCovered = new ArrayList<>();
		List<Map<String, Object>> leaseApproved = new ArrayList<>();
		List<Map<String, Object>> leaseTotal = new ArrayList<>();
		for (Map<String, Object> record : dataUlb) {
			Map<String, Object> ulbCoveredPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					ulbCoveredPerWeek.put("w" + week + "leaseulbc", record.get("ulbcovered"));
				}
			}
			ulbCovered.add(ulbCoveredPerWeek);
		}
		
		for (Map<String, Object> record : dataLease) {
			Map<String, Object> leaseApprovedPerWeek = new HashMap<>();
			Map<String, Object> leaseTotalPerWeek = new HashMap<>();
			String prefix = "Week";
			Integer noOfWeeks = 6;
			for (int week = 0; week < noOfWeeks; week++) {
				if (record.get("day").equals(prefix + week)) {
					leaseTotalPerWeek.put("w" + week + "leaseappltotal", record.get("leaseappltotal"));
					leaseApprovedPerWeek.put("w" + week + "leaseaplappr", record.get("leaseapplapproved"));
				}
			}
			leaseApproved.add(leaseApprovedPerWeek);
			leaseTotal.add(leaseTotalPerWeek);
		}

		LAMS lams = LAMS.builder().ulbCovered(ulbCovered).leaseApproved(leaseApproved).leaseTotal(leaseTotal).build();
		body.setLams(lams);
	}
}