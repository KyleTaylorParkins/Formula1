# Formula 1

This app lets you integrate the current Formula 1 schedule in Homey!

## Functionality

- Flow trigger when race starts
Triggers when the race starts. Has tokens for race name and location

- Flow trigger with timer before the race starts
Triggers a setable amount of time before the race starts

- Flow trigger with winner token
Triggers after the race when the winner is determined. Token with the name of the winner.

- Flow condition if racing
Condition that is true when a race is ongoing

- App Flow tokens
Tokens with the current championship standings.

## Changelog
- v1.0.5
Build in basic API caching to reduce the load on the remote server.
Added a few checks to prevent the app from crashing when there is no data.

- v1.0.3
Cancel timers for Flows when setting new ones. This should resolve the issue that Flows related to the race start are triggered multiple times.

- v1.0.2
Don't trigger flows after race start.
Various small bug fixes

- v1.0.0.
First release