Feature: User Registration
  As a new user
  I want to register for an account
  So that I can access the social media platform

  Background:
    Given the system is running
    And I am not logged in
    And the database is clean

  Scenario: Successful registration with valid data
    When I register with:
      | Field           | Value                |
      | username        | johndoe              |
      | email           | john@example.com     |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | John Doe             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456789        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 201 status code
    And the response should indicate success
    And a user account should be created with username "johndoe"
    And I should be automatically logged in

  Scenario: Registration with password mismatch
    When I register with:
      | Field           | Value                |
      | username        | johndoe2             |
      | email           | john2@example.com    |
      | password        | SecurePass123!       |
      | confirm_password| DifferentPass123!    |
      | full_name       | John Doe             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456788        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the response should indicate failure
    And the error should contain "password"
    And no user account should be created

  Scenario: Registration with underage user (12 years old)
    When I register with:
      | Field           | Value                |
      | username        | underageuser        |
      | email           | underage@example.com|
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | Under Age           |
      | date_of_birth   | 2015-01-15           |
      | phone_number    | +233123456787        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the response should indicate failure
    And the error should contain "date_of_birth"
    And the registration attempt should be blacklisted
    And the blacklist should contain email "underage@example.com"

  Scenario: Registration with existing email
    Given a user exists with:
      | Field        | Value                |
      | username     | existinguser        |
      | email        | existing@example.com|
      | password     | TestPass123!         |
    When I register with:
      | Field           | Value                |
      | username        | newuser              |
      | email           | existing@example.com |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | New User             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456786        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the error should contain "email"
    And no user account should be created

  Scenario: Registration with existing username
    Given a user exists with:
      | Field        | Value                |
      | username     | takenuser           |
      | email        | taken@example.com    |
      | password     | TestPass123!         |
    When I register with:
      | Field           | Value                |
      | username        | takenuser            |
      | email           | new@example.com      |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | New User             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456785        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the error should contain "username"
    And no user account should be created

  Scenario: Registration with existing phone number
    Given a user exists with:
      | Field        | Value                |
      | username     | phoneuser           |
      | email        | phone@example.com    |
      | password     | TestPass123!         |
      | phone_number | +233123456789        |
    When I register with:
      | Field           | Value                |
      | username        | newuser2             |
      | email           | new2@example.com     |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | New User             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456789        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the error should contain "phone_number"
    And no user account should be created

  Scenario: Registration with invalid username format (special characters)
    When I register with:
      | Field           | Value                |
      | username        | john@doe             |
      | email           | john3@example.com    |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | John Doe             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456784        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the error should contain "username"
    And the error message should mention "letters, numbers, and underscores"

  Scenario: Registration with username too short (2 characters)
    When I register with:
      | Field           | Value                |
      | username        | jo                   |
      | email           | john4@example.com    |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | John Doe             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456783        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the error should contain "username"
    And the error message should mention "at least 3 characters"

  Scenario: Registration with non-African country (USA)
    When I register with:
      | Field           | Value                |
      | username        | johndoe5             |
      | email           | john5@example.com    |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | John Doe             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456782        |
      | country         | US                   |
      | city            | New York             |
    Then I should receive a 400 status code
    And the error should contain "country"
    And no user account should be created

  Scenario: Blacklisted email cannot register
    Given an email "blacklisted@example.com" is blacklisted for "underage"
    When I register with:
      | Field           | Value                |
      | username        | newuser3             |
      | email           | blacklisted@example.com |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | New User             |
      | date_of_birth   | 2000-01-15           |
      | phone_number    | +233123456781        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 400 status code
    And the error should contain "non_field_errors"
    And no user account should be created

  Scenario: User exactly 13 years old can register
    When I register with:
      | Field           | Value                |
      | username        | thirteenuser        |
      | email           | thirteen@example.com |
      | password        | SecurePass123!       |
      | confirm_password| SecurePass123!       |
      | full_name       | Thirteen User        |
      | date_of_birth   | 2013-01-01           |
      | phone_number    | +233123456780        |
      | country         | GH                   |
      | city            | Accra                |
    Then I should receive a 201 status code
    And a user account should be created with username "thirteenuser"