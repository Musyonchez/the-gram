Feature: User Logout
  As an authenticated user
  I want to logout from my account
  So that I can secure my session

  Background:
    Given a user exists with:
      | username | email | password |
      | testuser | test@example.com | TestPass123! |
    And I am logged in as "testuser"

  Scenario: Successful logout
    When I logout
    Then I should receive a 200 status code
    And I should be logged out

  Scenario: Logout without authentication
    Given I am not logged in
    When I logout
    Then I should receive a 403 status code