## Overall Goal
The goal of this app is to understand each user's Instagram profile (the kinds of things they like on Instagram) to get a sense of their personality and interests, and will match them to other people who might be interested in the same things. This matching is proximity based (using Bluetooth Low Energy to find people in their general vacinity) and will text them when they are closeby.

## Steps

1. First, a user will have to log into Muse AI account and set up the agent so that it will run the rest of our code. This general setup should already have been done from the browserbase code. The general setup prompt will be given in later instructions.

2. Then, the Muse agent will look at their Instagram profile, understand it, and add it to a Spacetime DB. This prompt will also be given later.

3. When adding the information to the database, it will add it based on the username, their full name, and a summary of their instagram profile.

4. Then, a new process begins where the phone will start broadcasting their username to all of the other phones. This is done and completed in the ble part

5. When a phone receives a username, it will search the database for that username to find their Instagram summary. The summary is then compared to the user's summary to get a similarity score. This will be done by the Muse AI agent. That similarity score prompt will be given later.

6. When someone has found a match (a value that is thresholded based on a hyperparameter, will be tuned), then it will send a text to the user. This has not had any code yet but will be done via Photon. Do not do this yet, but include infrastructure to be able to let this happen.

7. In theory this should loop back to step 4. However, for now set LOOP to be false but include infrastructure to enable to happen in theory.

It will also be useful to store all of the usernames that I have sent my user, that way it doesn't repeat.

## Implementation

This should all be done in a phone app, that can be made for iOS and Android. The current code for the web app should be ported to the phone app, such that it does not clutter much.

## Prompts

The setup prompt and agent look up prompt are in muse_agent_prompt.txt