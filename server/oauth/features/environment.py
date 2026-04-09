"""
Behave environment configuration for OAuth tests
"""
import os
import sys
from pathlib import Path

# Add the project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'the_gram.settings')

# Initialize Django
import django
django.setup()

# Now import Django modules
from django.db import connection
from django.core.management import call_command
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from oauth.models import BlacklistedRegistration

def before_all(context):
    """Setup before all tests run"""
    # Store models in context for use in steps
    context.User = get_user_model()
    context.BlacklistedRegistration = BlacklistedRegistration
    
    # Create API client
    context.client = APIClient()
    
    # Initialize context variables
    context.response = None
    context.response_data = None
    context.user = None
    context.access_token = None
    context.refresh_token = None
    
    print("\n=== Django initialized for OAuth tests ===")

def before_scenario(context, scenario):
    """Setup before each scenario"""
    # Reset database for clean state
    call_command('flush', interactive=False, verbosity=0)
    
    # Reset client and context
    context.client = APIClient()
    context.response = None
    context.response_data = None
    context.user = None
    context.access_token = None
    context.refresh_token = None
    
    # Initialize tracking lists
    context.created_users = []
    context.created_blacklist = []
    
    print(f"\n  Scenario: {scenario.name}")

def after_scenario(context, scenario):
    """Cleanup after each scenario"""
    # Clean up created users
    for user_id in getattr(context, 'created_users', []):
        try:
            context.User.objects.filter(id=user_id).delete()
        except:
            pass
    
    # Clean up blacklist entries
    for blacklist_id in getattr(context, 'created_blacklist', []):
        try:
            context.BlacklistedRegistration.objects.filter(id=blacklist_id).delete()
        except:
            pass

def after_all(context):
    """Cleanup after all tests"""
    connection.close()
    print("\n=== Tests completed ===")