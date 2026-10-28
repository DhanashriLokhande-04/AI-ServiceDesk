
        package com.aiservicedesk.service;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
public class OllamaService {

    private final RestClient restClient;

    public OllamaService() {
        this.restClient = RestClient.builder()
                .baseUrl("http://localhost:11434")
                .build();
    }

    public String generateSuggestion(String ticketDescription) {

        String prompt = """
                You are an experienced IT Service Desk support engineer.

                Analyze the following IT support ticket:
                %s

                Provide your response using exactly these sections:

                Category: Choose one appropriate category such as
                Hardware, Software, Network/Internet, Account/Access,
                Security, or Other.

                Priority: Choose Low, Medium, or High.
                Explain the priority briefly.

                Short Solution:
                Provide 3 to 5 practical troubleshooting steps relevant
                to the reported issue.

                Important rules:
                1. Give steps directly related to the reported problem.
                2. Do not invent facts about the user's system.
                3. Do not suggest unrelated commands or services.
                4. Start with simple, safe troubleshooting steps.
                5. Do not ask the user to share passwords or secrets.
                6. If the issue is unclear, state what information is needed.
                """.formatted(ticketDescription);

        Map<String, Object> request = Map.of(
                "model", "qwen2.5:3b",
                "prompt", prompt,
                "stream", false
        );

        Map<?, ?> response = restClient.post()
                .uri("/api/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(Map.class);

        if (response == null || response.get("response") == null) {
            return "AI suggestion is currently unavailable.";
        }

        return response.get("response").toString().trim();
    }
}
