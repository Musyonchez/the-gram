Feature: Profile Management
  As a registered user
  I want to manage my profile information
  So that I can keep my account up to date

  Background:
    Given the system is running
    And the database is clean
    And a user exists with:
      | Field        | Value                |
      | username     | profileuser          |
      | email        | profile@example.com  |
      | password     | TestPass123!         |
      | full_name    | Profile User         |
      | bio          | Initial bio          |
      | city         | Accra                |
      | phone_number | +233123456780        |
      | date_of_birth| 2000-01-15           |
      | country      | GH                   |
    And I am logged in as "profileuser"

  Scenario: View my profile
    When I request my profile
    Then I should receive a 200 status code
    And the response user has username "profileuser"
    And the response user has email "profile@example.com"
    And the response user has full_name "Profile User"
    And the profile should have bio "Initial bio"
    And the profile should have city "Accra"
    And the profile should have age "26"

  Scenario: Update profile - change full name
    When I update my profile with:
      | Field     | Value              |
      | full_name | Updated Profile User|
    Then I should receive a 200 status code
    And the profile should have full_name "Updated Profile User"

  Scenario: Update profile - change bio
    When I update my profile with:
      | Field | Value                    |
      | bio   | New bio information here|
    Then I should receive a 200 status code
    And the profile should have bio "New bio information here"

  Scenario: Update profile - change city
    When I update my profile with:
      | Field | Value    |
      | city  | Kumasi   |
    Then I should receive a 200 status code
    And the profile should have city "Kumasi"

  Scenario: Update profile - multiple fields
    When I update my profile with:
      | Field     | Value              |
      | full_name | New Full Name      |
      | bio       | Updated biography  |
      | city      | Tema               |
    Then I should receive a 200 status code
    And the profile should have full_name "New Full Name"
    And the profile should have bio "Updated biography"
    And the profile should have city "Tema"

  Scenario: View another user's profile
    Given a user exists with:
      | Field        | Value                |
      | username     | otheruser            |
      | email        | other@example.com    |
      | password     | TestPass123!         |
      | full_name    | Other User           |
      | phone_number | +233123456779        |
      | date_of_birth| 2000-01-15           |
      | country      | GH                   |
      | city         | Tema                 |
    When I request profile for username "otheruser"
    Then I should receive a 200 status code
    And the response user has username "otheruser"
    And the response user has full_name "Other User"

  Scenario: View non-existent user profile
    When I request profile for username "nonexistent"
    Then I should receive a 404 status code
    And the response should indicate user not found