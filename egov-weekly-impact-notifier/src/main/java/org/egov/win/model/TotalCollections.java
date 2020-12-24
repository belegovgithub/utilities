package org.egov.win.model;

import java.util.List;
import java.util.Map;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;

@Data
@ToString
@Builder
@AllArgsConstructor
@NoArgsConstructor
@EqualsAndHashCode
public class TotalCollections {
	
	private List<Map<String, Object>> revenueCollected;
	private List<Map<String, Object>> servicesAvailed;
	private List<Map<String, Object>> citizensRegistered;

}
