Feature: Account Validation
  As a potential user
  I want to validate my credentials before registration
  So that I can ensure my desired username/email is available

  Background:
    Given the system is running
    And the database is clean
    And a user exists with:
      | Field        | Value                |
      | username     | existinguser         |
      | email        | existing@example.com |
      | password     | TestPass123!         |
      | full_name    | Existing User        |
      | phone_number | +233123456777        |
      | date_of_birth| 2000-01-15           |
      | country      | GH                   |
      | city         | Accra                |

  Scenario: Check available username
    When I check username "newusername"
    Then I should receive a 200 status code
    And the response should indicate username is available

  Scenario: Check taken username
    When I check username "existinguser"
    Then I should receive a 200 status code
    And the response should indicate username is taken

  Scenario: Check available email
    When I check email "new@example.com"
    Then I should receive a 200 status code
    And the response should indicate email is available

  Scenario: Check taken email
    When I check email "existing@example.com"
    Then I should receive a 200 status code
    And the response should indicate email is taken

  Scenario: Check username with invalid format
    When I check username "invalid@user"
    Then I should receive a 400 status code
    And the error message should mention "invalid"

  Scenario: Check username with missing value
    When I check username ""
    Then I should receive a 400 status code
    And the error message should mention "required"

  Scenario: Check email with missing value
    When I check email ""
    Then I should receive a 400 status code
    And the error message should mention "required"