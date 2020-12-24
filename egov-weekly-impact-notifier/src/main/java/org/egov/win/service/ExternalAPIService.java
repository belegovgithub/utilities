package org.egov.win.service;

import java.text.DecimalFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.egov.common.contract.request.RequestInfo;
import org.egov.mdms.model.MdmsCriteriaReq;
import org.egov.tracer.model.CustomException;
import org.egov.win.config.PropertyManager;
import org.egov.win.model.SearcherRequest;
import org.egov.win.model.TL;
import org.egov.win.repository.ServiceCallRepository;
import org.egov.win.utils.CronConstants;
import org.egov.win.utils.CronUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.jayway.jsonpath.JsonPath;

import lombok.extern.slf4j.Slf4j;

@Service
@Slf4j
public class ExternalAPIService {
	
	@Autowired
	private ServiceCallRepository repository;

	@Autowired
	private CronUtils utils;
	
	@Autowired
	private PropertyManager propertyManager;
	
	public List<Map<String, Object>> getRainmakerData(String defName) {
		StringBuilder uri = new StringBuilder();
		ObjectMapper mapper = utils.getObjectMapper();
		List<Map<String, Object>> data = new ArrayList<>();
		SearcherRequest request = utils.preparePlainSearchReq(uri, defName);
		Optional<Object> response = repository.fetchResult(uri, request);
		try {
			if(response.isPresent()) {
				Object parsedResponse = mapper.convertValue(response.get(), Map.class);
				List<Object> dataParsedToList = mapper.convertValue(JsonPath.read(parsedResponse, "$.data"), List.class);
				for (Object record : dataParsedToList) {
					data.add(mapper.convertValue(record, Map.class));
				}
			}

		} catch (Exception e) {
			throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from the db");
		}
		System.out.println("data for: "+ defName+ " is"+data);
		return data;

	}
	
	
	public List<Map<String, Object>> getWSData() {
		StringBuilder uri = new StringBuilder();
		ObjectMapper mapper = utils.getObjectMapper();
		List<Map<String, Object>> data = new ArrayList<>();
		utils.prepareWSSearchReq(uri);
		Object request = "{}";
		Optional<Object> response = repository.fetchResult(uri, request);
		try {
			if(response.isPresent()) {
				List<Object> dataParsedToList = mapper.convertValue(response.get(), List.class);
				for (Object record : dataParsedToList) {
					data.add(mapper.convertValue(record, Map.class));
				}
			}
		} catch (Exception e) {
			throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from WS module");
		}

		return data;

	}
	
	/**
	 * Method to fetch event types from MDMS
	 * 
	 * @param requestInfo
	 * @param tenantId
	 * @return
	 */
	public List<String> fetchAdhocTaxheads(RequestInfo requestInfo, String tenantId) {
		StringBuilder uri = new StringBuilder();
		MdmsCriteriaReq req = utils.getReqForTaxHeads(uri, requestInfo, tenantId);
		Optional<Object> response = repository.fetchResult(uri, req);
		List<String> codes = new ArrayList<>();
		try {
			if(response.isPresent()) {
				codes = JsonPath.read(response.get().toString(), CronConstants.MDMS_TAXHEAD_CODE_JSONPATH);
			}
		}catch(Exception e) {
			log.info("Res: "+ response.get());
			log.error("Exception while fetching from MDMS: ", e);
		}
;
		return codes;
	}

	public List<Map<String, Object>> getTLAmountReportData() {
		List<Map<String, Object>> data = new ArrayList<>();
		for (long weeks = 0; weeks <= 5; weeks++) {
			StringBuilder uri = new StringBuilder();
			ObjectMapper mapper = utils.getObjectMapper();
			utils.prepareTLAmountReportReq(uri);

			JsonObject jsonObject = new JsonObject();
			jsonObject.addProperty("reportName", "StateLevelTradeWiseCollection");
			JsonArray jArr = new JsonArray();

			JsonObject from = new JsonObject();
			from.addProperty("name", "fromDate");
			from.addProperty("input", new Long("0"));

			JsonObject to = new JsonObject();
			to.addProperty("name", "toDate");
			long miiliSecsperDay = 86400000l; // 24*60*60*1000 ;
			long miiliSecInWeek = (long) 7*miiliSecsperDay;
			long currentTime = System.currentTimeMillis();
			long sundayNightOffset = ((long)propertyManager.getWeekendOffset()*miiliSecsperDay - (18000000l) - (1800000l) -(1000l)); //5*60*60*1000 - 30*60*1000 - 1000 millisecs// GMT Hours 05:30 - 1 sec
			long aheadOfThursday = currentTime % miiliSecInWeek;
			long toAddweekend = 0l;
			if(aheadOfThursday < sundayNightOffset)
				toAddweekend = sundayNightOffset - aheadOfThursday;
			else
				toAddweekend = miiliSecInWeek - (aheadOfThursday - sundayNightOffset) ;
			to.addProperty("input",(currentTime+toAddweekend-(miiliSecInWeek*weeks)));
			jArr.add(from);
			jArr.add(to);

			JsonObject rInfo = new JsonObject();
			rInfo.addProperty("ts", System.currentTimeMillis());

			jsonObject.add("searchParams", jArr);
			jsonObject.add("RequestInfo", rInfo);

			Optional<Object> response = repository.fetchResultj(uri, jsonObject);

			try {
				if (response.isPresent()) {
					Object parsedResponse = mapper.convertValue(response.get(), Map.class);
					List<List<List<Object>>> dataParsedToList = mapper.convertValue(JsonPath.read(parsedResponse, "$.reportData"), List.class);
					List<List<Object>> dataParsedreportDataToList = mapper.convertValue(dataParsedToList, List.class);
					Set<String> ulbs = new HashSet<String>();
					Float sum2 = (float) 0.0;
					for (List<Object> obj : dataParsedreportDataToList) {
						ulbs.add(obj.get(0).toString());
						sum2 += Float.parseFloat(obj.get(5).toString());
					}
					DecimalFormat df = new DecimalFormat("#.##");
					Map<String, Object> e = new HashMap<String, Object>();
					e.put("ulbcovered", ulbs.size());
					e.put("revenuecollected", df.format(sum2/100000));
					e.put("day", "Week"+weeks);
					data.add(e);
				}

			} catch (Exception e) {
				throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from the db");
			}
		}
		log.info("data "+data);
		return data;
	}
	
	public List<Map<String, Object>> getTLLicenceReportData() {
		List<Map<String, Object>> data = new ArrayList<>();
		for (long weeks = 0; weeks <= 5; weeks++) {
			StringBuilder uri = new StringBuilder();
			ObjectMapper mapper = utils.getObjectMapper();
			utils.prepareTLAmountReportReq(uri);

			JsonObject jsonObject = new JsonObject();
			jsonObject.addProperty("reportName", "StateLevelStatus");
			JsonArray jArr = new JsonArray();

			JsonObject from = new JsonObject();
			from.addProperty("name", "fromDate");
			from.addProperty("input", new Long("0"));

			JsonObject to = new JsonObject();
			to.addProperty("name", "toDate");
			long miiliSecsperDay = 86400000l; // 24*60*60*1000 ;
			long miiliSecInWeek = (long) 7*miiliSecsperDay;
			long currentTime = System.currentTimeMillis();
			long sundayNightOffset = ((long)propertyManager.getWeekendOffset()*miiliSecsperDay - (18000000l) - (1800000l) -(1000l)); //5*60*60*1000 - 30*60*1000 - 1000 millisecs// GMT Hours 05:30 - 1 sec
			long aheadOfThursday = currentTime % miiliSecInWeek;
			long toAddweekend = 0l;
			if(aheadOfThursday < sundayNightOffset)
				toAddweekend = sundayNightOffset - aheadOfThursday;
			else
				toAddweekend = miiliSecInWeek - (aheadOfThursday - sundayNightOffset) ;
			to.addProperty("input",(currentTime+toAddweekend-(miiliSecInWeek*weeks)));
			jArr.add(from);
			jArr.add(to);

			JsonObject rInfo = new JsonObject();
			rInfo.addProperty("ts", System.currentTimeMillis());

			jsonObject.add("searchParams", jArr);
			jsonObject.add("RequestInfo", rInfo);

			Optional<Object> response = repository.fetchResultj(uri, jsonObject);

			try {
				if (response.isPresent()) {
					Object parsedResponse = mapper.convertValue(response.get(), Map.class);
					List<List<List<Object>>> dataParsedToList = mapper.convertValue(JsonPath.read(parsedResponse, "$.reportData"), List.class);
					List<List<Object>> dataParsedreportDataToList = mapper.convertValue(dataParsedToList, List.class);
					Map<String, Object> e = new HashMap<String, Object>();
					int sum2 = 0;
					for (List<Object> obj : dataParsedreportDataToList) {
						sum2 += Integer.parseInt(obj.get(1).toString());
					}
					e.put("licenseissued", dataParsedreportDataToList.get(0).get(1));
					e.put("day", "Week"+weeks);
					e.put("licensetotal", sum2);
					data.add(e);
				}

			} catch (Exception e) {
				throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from the db");
			}
		}
		log.info("data "+data);
		return data;
	}
	
	
	public List<Map<String, Object>> getMiscReportData() {
		List<Map<String, Object>> data = new ArrayList<>();
		for (long weeks = 0; weeks <= 5; weeks++) {
			StringBuilder uri = new StringBuilder();
			ObjectMapper mapper = utils.getObjectMapper();
			utils.prepareMiscReportReq(uri);
			JsonObject jsonObject = new JsonObject();
			jsonObject.addProperty("reportName", "StateLevelMiscReceipt");
			JsonArray jArr = new JsonArray();

			JsonObject from = new JsonObject();
			from.addProperty("name", "fromDate");
			from.addProperty("input", new Long("0"));

			JsonObject to = new JsonObject();
			to.addProperty("name", "toDate");
			long miiliSecsperDay = 86400000l; // 24*60*60*1000 ;
			long miiliSecInWeek = (long) 7*miiliSecsperDay;
			long currentTime = System.currentTimeMillis();
			long sundayNightOffset = ((long)propertyManager.getWeekendOffset()*miiliSecsperDay - (18000000l) - (1800000l) -(1000l)); //5*60*60*1000 - 30*60*1000 - 1000 millisecs// GMT Hours 05:30 - 1 sec
			long aheadOfThursday = currentTime % miiliSecInWeek;
			long toAddweekend = 0l;
			if(aheadOfThursday < sundayNightOffset)
				toAddweekend = sundayNightOffset - aheadOfThursday;
			else
				toAddweekend = miiliSecInWeek - (aheadOfThursday - sundayNightOffset) ;
			to.addProperty("input",(currentTime+toAddweekend-(miiliSecInWeek*weeks)));
			jArr.add(from);
			jArr.add(to);

			JsonObject rInfo = new JsonObject();
			rInfo.addProperty("ts", System.currentTimeMillis());

			jsonObject.add("searchParams", jArr);
			jsonObject.add("RequestInfo", rInfo);

			Optional<Object> response = repository.fetchResultj(uri, jsonObject);

			try {
				if (response.isPresent()) {
					Object parsedResponse = mapper.convertValue(response.get(), Map.class);
					List<List<List<Object>>> dataParsedToList = mapper.convertValue(JsonPath.read(parsedResponse, "$.reportData"), List.class);
					List<List<Object>> dataParsedreportDataToList = mapper.convertValue(dataParsedToList, List.class);
					Set<String> ulbs = new HashSet<String>();
					int sum1 = 0;
					Float sum2 = (float) 0.0;
					for (List<Object> obj : dataParsedreportDataToList) {
						ulbs.add(obj.get(0).toString());
						sum1 += Integer.parseInt(obj.get(1).toString());
						sum2 += Float.parseFloat(obj.get(7).toString());
					}
					DecimalFormat df = new DecimalFormat("#.##");
					Map<String, Object> e = new HashMap<String, Object>();
					e.put("ulb", ulbs.size());
					e.put("receiptscreated", sum1);
					e.put("revenuecollected", df.format(sum2/100000));
					e.put("day", "Week"+weeks);
					data.add(e);
				}

			} catch (Exception e) {
				throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from the db");
			}
		}
		log.info("data "+data);
		return data;
	}
	
	public List<Map<String, Object>> getPGRReportData() {
		List<Map<String, Object>> data = new ArrayList<>();
		for (long weeks = 0; weeks <= 5; weeks++) {
			StringBuilder uri = new StringBuilder();
			ObjectMapper mapper = utils.getObjectMapper();
			utils.preparePGRReportReq(uri);
			JsonObject jsonObject = new JsonObject();
			jsonObject.addProperty("reportName", "ComplaintTypesReport");
			JsonArray jArr = new JsonArray();

			JsonObject from = new JsonObject();
			from.addProperty("name", "fromDate");
			from.addProperty("input", new Long("0"));

			JsonObject to = new JsonObject();
			to.addProperty("name", "toDate");
			
			long miiliSecsperDay = 86400000l; // 24*60*60*1000 ;
			long miiliSecInWeek = (long) 7*miiliSecsperDay;
			long currentTime = System.currentTimeMillis();
			long sundayNightOffset = ((long)propertyManager.getWeekendOffset()*miiliSecsperDay - (18000000l) - (1800000l) -(1000l)); //5*60*60*1000 - 30*60*1000 - 1000 millisecs// GMT Hours 05:30 - 1 sec
			long aheadOfThursday = currentTime % miiliSecInWeek;
			long toAddweekend = 0l;
			if(aheadOfThursday < sundayNightOffset)
				toAddweekend = sundayNightOffset - aheadOfThursday;
			else
				toAddweekend = miiliSecInWeek - (aheadOfThursday - sundayNightOffset) ;
			to.addProperty("input",(currentTime+toAddweekend-(miiliSecInWeek*weeks)));
			jArr.add(from);
			jArr.add(to);

			JsonObject rInfo = new JsonObject();
			rInfo.addProperty("ts", System.currentTimeMillis());

			jsonObject.add("searchParams", jArr);
			jsonObject.add("RequestInfo", rInfo);

			Optional<Object> response = repository.fetchResultj(uri, jsonObject);

			try {
				if (response.isPresent()) {
					Object parsedResponse = mapper.convertValue(response.get(), Map.class);
					List<List<List<Object>>> dataParsedToList = mapper.convertValue(JsonPath.read(parsedResponse, "$.reportData"), List.class);
					List<List<Object>> dataParsedreportDataToList = mapper.convertValue(dataParsedToList, List.class);
					Set<String> ulbs = new HashSet<String>();
					Float sum1 = (float) 0.0;
					int sum2 = 0;
					for (List<Object> obj : dataParsedreportDataToList) {
						ulbs.add(obj.get(0).toString());
						sum1 += (Float.parseFloat(obj.get(4).toString()) + Float.parseFloat(obj.get(6).toString()));
						sum2 += Integer.parseInt(obj.get(7).toString());
					}
					DecimalFormat df = new DecimalFormat("#.##");
					Map<String, Object> e = new HashMap<String, Object>();
					e.put("ulbcovered", ulbs.size());
					e.put("redressal", df.format(sum1*100/sum2));
					e.put("totalcomplaints", sum2);
					e.put("day", "Week"+weeks);
					data.add(e);
				}

			} catch (Exception e) {
				throw new CustomException("EMAILER_DATA_RETREIVAL_FAILED", "Failed to retrieve data from the db");
			}
		}
		log.info("data "+data);
		return data;
	}
}
