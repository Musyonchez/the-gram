Feature: Password Change
  As a registered user
  I want to change my password
  So that I can maintain account security

  Background:
    Given the system is running
    And the database is clean
    And a user exists with:
      | Field        | Value                |
      | username     | passuser             |
      | email        | pass@example.com     |
      | password     | OldPass123!          |
      | full_name    | Password User        |
      | phone_number | +233123456778        |
      | date_of_birth| 2000-01-15           |
      | country      | GH                   |
      | city         | Accra                |
    And I am logged in as "passuser"

  Scenario: Successfully change password
    When I change my password from "OldPass123!" to "NewPass456!"
    Then I should receive a 200 status code
    And the response should indicate success

  Scenario: Change password with wrong old password
    When I change my password from "WrongPass123!" to "NewPass456!"
    Then I should receive a 400 status code
    And the error should contain "old_password"

  Scenario: Change password with mismatched confirmation
    When I change my password with:
      | Field               | Value           |
      | old_password        | OldPass123!     |
      | new_password        | NewPass456!     |
      | confirm_new_password| DifferentPass!  |
    Then I should receive a 400 status code
    And the error should contain "confirm_new_password"

  Scenario: Change password with weak new password
    When I change my password with:
      | Field               | Value           |
      | old_password        | OldPass123!     |
      | new_password        | weak            |
      | confirm_new_password| weak            |
    Then I should receive a 400 status code
    And the error message should mention "password"