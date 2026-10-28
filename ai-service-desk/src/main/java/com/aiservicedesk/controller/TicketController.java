
        package com.aiservicedesk.controller;

import com.aiservicedesk.service.OllamaService;
import com.aiservicedesk.service.TicketService;
import com.aiservicedesk.ticket.Ticket;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tickets")
@CrossOrigin(origins = {
        "http://localhost:5173",
        "http://localhost:5174"
})
public class TicketController {

    private final TicketService ticketService;
    private final OllamaService ollamaService;

    public TicketController(
            TicketService ticketService,
            OllamaService ollamaService) {

        this.ticketService = ticketService;
        this.ollamaService = ollamaService;
    }

    // Get all tickets
    @GetMapping
    public List<Ticket> getAllTickets() {
        return ticketService.getAllTickets();
    }

    // Create a ticket
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Ticket createTicket(@RequestBody Ticket ticket) {
        return ticketService.createTicket(ticket);
    }

    // Update a ticket
    @PutMapping("/{id}")
    public Ticket updateTicket(
            @PathVariable Long id,
            @RequestBody Ticket ticket) {

        return ticketService.updateTicket(id, ticket);
    }

    // Delete a ticket
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTicket(@PathVariable Long id) {
        ticketService.deleteTicket(id);
    }

    // Generate AI suggestion for a ticket description
    @PostMapping("/ai-suggestion")
    public Map<String, String> getAiSuggestion(
            @RequestBody Map<String, String> request) {

        String description = request.get("description");

        if (description == null || description.isBlank()) {
            throw new IllegalArgumentException(
                    "Ticket description must not be empty."
            );
        }

        String suggestion =
                ollamaService.generateSuggestion(description);

        return Map.of("suggestion", suggestion);
    }
}