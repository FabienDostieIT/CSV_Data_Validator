#!/bin/bash

# Script to manage .env file for act and run GitHub Actions locally
# Usage: bash scripts/act-env-setup.sh [command]

# Define the .env file path
ENV_FILE=".act-secrets"

# Create a new .env file with user input
function create_env_file() {
  echo "Creating $ENV_FILE file for act..."
  
  echo "# GitHub and Vercel secrets for local testing with 'act'" > $ENV_FILE
  echo "# This file should not be committed to your repository" >> $ENV_FILE
  echo "" >> $ENV_FILE
  
  echo "Enter your Vercel token (from https://vercel.com/account/tokens):"
  read -s VERCEL_TOKEN
  echo "VERCEL_TOKEN=$VERCEL_TOKEN" >> $ENV_FILE
  echo ""
  
  echo "Enter your Vercel org ID (from your Vercel project settings):"
  read -s VERCEL_ORG_ID
  echo "VERCEL_ORG_ID=$VERCEL_ORG_ID" >> $ENV_FILE
  echo ""
  
  echo "Enter your Vercel project ID (from your Vercel project settings):"
  read -s VERCEL_PROJECT_ID
  echo "VERCEL_PROJECT_ID=$VERCEL_PROJECT_ID" >> $ENV_FILE
  echo ""
  
  echo "Enter your GitHub token (from https://github.com/settings/tokens) or press Enter to skip:"
  read -s GITHUB_TOKEN
  if [ -n "$GITHUB_TOKEN" ]; then
    echo "GITHUB_TOKEN=$GITHUB_TOKEN" >> $ENV_FILE
  fi
  echo ""
  
  echo "$ENV_FILE created successfully!"
  echo "This file is gitignored and won't be committed to your repository."
}

# Run act using the .env file
function run_act() {
  local workflow_file=$1
  local event_type=${2:-push}
  local job_id=${3:-deploy}
  
  if [ -z "$workflow_file" ]; then
    echo "Error: Workflow file not specified"
    echo "Usage: bash scripts/act-env-setup.sh run [workflow_file] [event_type] [job_id]"
    echo "Example: bash scripts/act-env-setup.sh run .github/workflows/vercel.yml push deploy"
    return 1
  fi
  
  # Check if act is the latest version
  ACT_VERSION=$(act --version 2>&1 | grep -oP 'act version \K[0-9]+\.[0-9]+\.[0-9]+' || echo "0.0.0")
  if [[ "$ACT_VERSION" != "0.2.76" ]]; then
    echo "ℹ️ NOTE: You're using act version $ACT_VERSION. Version 0.2.76 is recommended."
    echo "To upgrade: 'brew upgrade act' (macOS) or download from https://github.com/nektos/act/releases"
    echo "----"
  fi
  
  # Check if Docker is running
  if ! docker info &>/dev/null; then
    echo "Error: Docker is not running. Please start Docker and try again."
    return 1
  fi
  
  # Check if .env file exists
  if [ ! -f "$ENV_FILE" ]; then
    echo "Error: $ENV_FILE file not found."
    echo "Run 'bash scripts/act-env-setup.sh create' to create it first."
    return 1
  fi
  
  # Check if workflow file exists
  if [ ! -f "$workflow_file" ]; then
    echo "Error: Workflow file '$workflow_file' not found."
    return 1
  fi
  
  # Load environment variables from .env file
  echo "Loading secrets from $ENV_FILE..."
  set -a # automatically export all variables
  source $ENV_FILE
  set +a # disable auto-export
  
  # Prepare secret flags
  SECRET_FLAGS=""
  if [ -n "$VERCEL_TOKEN" ]; then
    SECRET_FLAGS="$SECRET_FLAGS --secret VERCEL_TOKEN"
  fi
  if [ -n "$VERCEL_ORG_ID" ]; then
    SECRET_FLAGS="$SECRET_FLAGS --secret VERCEL_ORG_ID"
  fi
  if [ -n "$VERCEL_PROJECT_ID" ]; then
    SECRET_FLAGS="$SECRET_FLAGS --secret VERCEL_PROJECT_ID"
  fi
  if [ -n "$GITHUB_TOKEN" ]; then
    SECRET_FLAGS="$SECRET_FLAGS --secret GITHUB_TOKEN"
  fi
  
  # Ensure event file exists
  EVENT_FILE=".github/workflows/test-events/$event_type.json"
  if [ ! -f "$EVENT_FILE" ]; then
    echo "Warning: Event file '$EVENT_FILE' not found. Using default event."
    EVENT_PARAM=""
  else
    EVENT_PARAM="-e $EVENT_FILE"
  fi
  
  # Run act with additional flags - explicitly specify job ID to avoid ambiguity
  echo "Running workflow: $workflow_file with event: $event_type, job: $job_id"
  echo "Running dry run first..."
  act -j $job_id \
    -W $workflow_file \
    $EVENT_PARAM \
    --container-architecture linux/amd64 \
    --use-gitignore \
    $SECRET_FLAGS \
    --dryrun
  
  # Ask for confirmation before actual run
  echo ""
  echo "The above is a dry run. Ready to run the actual workflow? (y/n)"
  read confirmation
  
  if [[ "$confirmation" == "y" || "$confirmation" == "Y" ]]; then
    echo "Running actual workflow..."
    act -j $job_id \
      -W $workflow_file \
      $EVENT_PARAM \
      --container-architecture linux/amd64 \
      --use-gitignore \
      $SECRET_FLAGS
  else
    echo "Workflow run cancelled."
  fi
}

# List available workflows and jobs
function list_workflows() {
  echo "Listing available workflows and jobs:"
  act --list
}

# Display usage information
function show_help() {
  echo "Act Environment Setup Script"
  echo "----------------------------"
  echo "Usage: bash scripts/act-env-setup.sh [command]"
  echo ""
  echo "Commands:"
  echo "  create                      Create a new $ENV_FILE file with your secrets"
  echo "  run [workflow] [event] [job] Run a GitHub Actions workflow locally"
  echo "  list                        List all available workflows and jobs"
  echo "  help                        Show this help message"
  echo ""
  echo "Examples:"
  echo "  bash scripts/act-env-setup.sh create"
  echo "  bash scripts/act-env-setup.sh run .github/workflows/vercel.yml push deploy"
  echo "  bash scripts/act-env-setup.sh list"
}

# Main script logic
case "$1" in
  "create")
    create_env_file
    ;;
  "run")
    run_act "$2" "$3" "$4"
    ;;
  "list")
    list_workflows
    ;;
  "help"|*)
    show_help
    ;;
esac 