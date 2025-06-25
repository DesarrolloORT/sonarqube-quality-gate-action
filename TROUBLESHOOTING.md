# SonarQube Quality Gate Action - Troubleshooting Guide

## Issue: Grey Question Mark (?) Status After Upgrading to Developer Edition

### Quick Fixes Applied:

1. **Enhanced Authentication**: The action now tries both Bearer token and Basic
   authentication methods
2. **Better Error Logging**: More detailed logging to help identify the exact
   issue
3. **Response Validation**: Validates the API response structure and handles
   missing data
4. **Additional Status Types**: Added support for more status types including
   `IN_PROGRESS`, `PENDING`, `WARNING`

### What was changed:

#### 1. `src/modules/sonarqube-api.ts`:

- Added dual authentication (Bearer token first, Basic auth fallback)
- Enhanced error logging with response details
- Added response structure validation
- Better error messages

#### 2. `src/modules/utils.ts`:

- Added more status types support
- Improved number formatting with edge case handling
- Added logging for unknown statuses

#### 3. `src/modules/report.ts`:

- Added handling for empty conditions arrays
- Better fallback when metrics are not available
- Enhanced logging

#### 4. `src/main.ts`:

- Added more logging after successful API calls

### Debug Workflow:

Use the new `.github/workflows/debug.yml` to test the action manually:

1. Go to Actions tab in your repository
2. Select "Debug SonarQube Quality Gate" workflow
3. Click "Run workflow"
4. Fill in your SonarQube server URL and project key
5. Run and check the logs for detailed information

### Manual Testing:

You can also test the API directly using curl:

```bash
# Test with Bearer token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-sonar-server.com/api/qualitygates/project_status?projectKey=YOUR_PROJECT_KEY"

# Test with Basic auth
curl -u "YOUR_TOKEN:" \
  "https://your-sonar-server.com/api/qualitygates/project_status?projectKey=YOUR_PROJECT_KEY"
```

### Common Issues with Developer Edition:

1. **Different API Authentication**: Developer edition might require Bearer
   token instead of Basic auth
2. **New Response Structure**: API response might include additional fields or
   different structure
3. **Permission Changes**: Your token might need additional permissions in
   Developer edition
4. **API Version Changes**: Developer edition might use a different API version

### Next Steps:

1. **Build and deploy**: Run `npm run package` to build the updated action
2. **Test with debug workflow**: Use the debug workflow to see detailed logs
3. **Check token permissions**: Ensure your SonarQube token has the required
   permissions
4. **Verify project key**: Make sure the project key exactly matches your
   SonarQube project

### Token Permissions Required:

In SonarQube Developer Edition, ensure your token has:

- `Browse` permission on the project
- `Execute Analysis` permission (if applicable)

### If you're still seeing issues:

1. Check the GitHub Actions logs for the detailed API response
2. Verify your SonarQube server is accessible
3. Test the API endpoint manually using the curl commands above
4. Check if your SonarQube instance requires specific headers or has CORS
   restrictions
