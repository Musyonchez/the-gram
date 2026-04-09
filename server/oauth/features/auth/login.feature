Feature: User Login
  As a registered user
  I want to login to my account
  So that I can access protected resources

  Background:
    Given the system is running
    And the database is clean
    And a user exists with:
      | username | email | password | is_active |
      | testuser | test@example.com | TestPass123! | True |
    And I am not logged in

  Scenario: Successful login
    When I login with:
      | Field    | Value           |
      | username | testuser        |
      | password | TestPass123!    |
    Then I should receive a 200 status code
    And the response should indicate success
    And I should be logged in
    And the response user should have username "testuser"

  Scenario: Login with wrong password
    When I login with:
      | Field    | Value           |
      | username | testuser        |
      | password | WrongPassword!  |
    Then I should receive a 400 status code
    And the error should contain "non_field_errors"

  Scenario: Login with non-existent user
    When I login with:
      | Field    | Value           |
      | username | nonexistent     |
      | password | TestPass123!    |
    Then I should receive a 400 status code
    And the error should contain "non_field_errors"

  Scenario: Login without username
    When I login with:
      | Field    | Value           |
      | password | TestPass123!    |
    Then I should receive a 400 status code
    And the error should contain "Must include"

  Scenario: Login without password
    When I login with:
      | Field    | Value           |
      | username | testuser        |
    Then I should receive a 400 status code
    And the error should contain "password"