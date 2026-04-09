#!/usr/bin/env python
"""
Cucumber test runner for OAuth features
"""
import os
import sys
import django

def main():
    """Run behave tests"""
    # Set up Django environment
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'the_gram.settings')
    django.setup()
    
    # Run behave tests
    try:
        from behave import __main__ as behave_main
        
        # Set the features directory
        features_dir = os.path.join('oauth', 'features')
        
        # Build arguments
        sys.argv = [
            'behave',
            features_dir,
            '--format', 'pretty',
            '--no-capture',
            '--no-capture-stderr'
        ]
        
        # Add optional tags if specified
        if '--tags' in sys.argv:
            # Tags already specified
            pass
        
        # Run the tests
        result = behave_main.main()
        
        # Exit with appropriate code
        sys.exit(result)
        
    except ImportError:
        print("Error: behave not installed. Run: pip install behave django-behave")
        sys.exit(1)
    except Exception as e:
        print(f"Error running tests: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()