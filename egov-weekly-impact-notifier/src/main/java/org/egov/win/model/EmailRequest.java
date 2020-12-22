package org.egov.win.model;

import org.egov.common.contract.request.RequestInfo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.ToString;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@EqualsAndHashCode
@Builder
@ToString
public class EmailRequest {
    /*private String email;
    private String subject;
    private String body;
    @JsonProperty("isHTML")
    private boolean isHTML;*/
	private RequestInfo requestInfo;
    
    private Email email;
}
