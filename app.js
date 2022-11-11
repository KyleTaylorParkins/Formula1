'use strict';

const Homey			= require('homey');
const FormulaOneApi = require('./lib/FormulaOneApi');

const MINUTE				= 1		* 60	  * 1000;		// One minute used for timouts etc
const AFTER_RACE_TIMEOUT	= 3		* 60 * 60 * 1000;		// 3 hours timeout for after the race
const RACE_DURATION			= 2		* 60 * 60 * 1000;		// 2 hours in which the race should be finished
const DATA_REFRESH_TIMEOUT	= 24	* 60 * 60 * 1000;		// 24 hours data refresh
const TIMER_THRESHOLD		= 2* 24 * 60 * 60 * 1000;		// 2 Days threshold for timers
const TEST_REFRESH			= 1			 * 60 * 1000;		// 5 minute test timeout

class FormulaOne extends Homey.App {
	
	async onInit() {
		this.test = false;

		this.api = new FormulaOneApi(this.test);

		// Create the Flows
    	this.raceStartTriggerFlow = this.homey.flow.getTriggerCard('race_start');

		this.qualiStartsInTriggerFlow = this.homey.flow.getTriggerCard('qualifying_in');
		this.qualiStartsInTriggerFlow.registerRunListener(async (args, state) => {
			if (args.time_before == state.time) return true;
			else return false;
		});

		this.raceStartsInTriggerFlow = this.homey.flow.getTriggerCard('race_in');
		this.raceStartsInTriggerFlow.registerRunListener(async (args, state) => {
			if (args.time_before == state.time) return true;
			else return false;
		});

		this.sprintRaceStartsInTriggerFlow = this.homey.flow.getTriggerCard('sprint_in');
		this.sprintRaceStartsInTriggerFlow.registerRunListener(async (args, state) => {
			if (args.time_before == state.time) return true;
			else return false;
		});

		this.raceWonByTriggerFlow = this.homey.flow.getTriggerCard('winner');

		this.isRacingConditionFlow = this.homey.flow.getConditionCard('is_racing');
		this.isRacingConditionFlow.registerRunListener(async (args, state) => {
			return this.isRaceOngoing();
		})

		this.nextRace = await this.api.getNextRace();

		if (this.nextRace !== null) {
			// Set Flow timeout
			this.setTimerBeforeRaceStart();
			this.setTimerBeforeQualifyingStart();
			this.setTimerBeforeSprintRaceStart();
			this.triggerWinnerFlow();

			// Create app tokens
			this.driverStandingTokens = [];
			await this.createDriverStandingTokens();
			this.fillDriverStandingTokens();
		}

		// Updater loopje
		const updaterTimeout = this.test ? TEST_REFRESH : DATA_REFRESH_TIMEOUT;
		this.updaterLoop = setInterval(async() => {
			this.log('Updating data from API');
			this.nextRace = await this.api.getNextRace();

			if (!this.nextRace !== null) {
				// Update all elements
				this.fillDriverStandingTokens();
				this.setTimerBeforeRaceStart();
				this.setTimerBeforeQualifyingStart();
				this.setTimerBeforeSprintRaceStart();
				this.triggerWinnerFlow();
			}
		}, updaterTimeout);
	}

	async setTimerBeforeRaceStart() {
		if (this.nextRace) {
			this.raceStartTime = new Date(`${this.nextRace.date}T${this.nextRace.time}`);

			const timeDelta = (this.raceStartTime.getTime() - Date.now());

			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; 			  // We don't want to trigger after the race has started

			this.log('Setting timers for race_start trigger with timeout', timeDelta);

			// If the timeout already exists, clear it to prevent multiple flow triggers
			if (this.raceStartTimeout) clearTimeout(this.raceStartTimeout);
			this.raceStartTimeout = setTimeout(() => {
				this.log('Starting race starts trigger');
				// Trigger the flow and create token data
				this.raceStartTriggerFlow.trigger({
					race_name: this.nextRace.raceName,
					circuit: this.nextRace.circuit,
				})
					.catch(err => this.log(err));
			}, timeDelta);
		}
	}

	async setTimerBeforeQualifyingStart() {
		if (this.nextRace) {
			this.raceStartTime = new Date(`${this.nextRace.qualifying.date}T${this.nextRace.qualifying.time}`);

			const timeDelta = (this.raceStartTime.getTime() - Date.now());

			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; 			  // We don't want to trigger after the race has started

			this.log('Setting timers for qualifying_in trigger with timeout', (timeDelta / 1000 / 60));

			const raceObject = {
				race_name: this.nextRace.raceName,
				circuit: this.nextRace.circuit,
			}

			if (this.fiveMinQualiTimeout) clearTimeout(this.fiveMinQualiTimeout);
			if (timeDelta >= (5 * MINUTE)) this.fiveMinQualiTimeout = setTimeout(() => {
				this.qualiStartsInTriggerFlow.trigger(raceObject, {time: "5"} );
			}, (timeDelta - (5 * MINUTE)) );
			
			if (this.tenMinQualiTimeout) clearTimeout(this.tenMinQualiTimeout);
			if (timeDelta >= (10 * MINUTE)) this.tenMinQualiTimeout = setTimeout(() => {
				this.qualiStartsInTriggerFlow.trigger(raceObject, {time: "10"} );
			}, (timeDelta - (10 * MINUTE)) );

			if (this.thirtyMinQualiTimeout) clearTimeout(this.thirtyMinQualiTimeout);
			if (timeDelta >= (30 * MINUTE)) this.thirtyMinQualiTimeout = setTimeout(() => {
				this.qualiStartsInTriggerFlow.trigger(raceObject, {time: "30"} );
			}, (timeDelta - (30 * MINUTE)) );

			if (this.sixtyMinQualiTimeout) clearTimeout(this.sixtyMinQualiTimeout);
			if (timeDelta >= (60 * MINUTE)) this.sixtyMinQualiTimeout = setTimeout(() => {
				this.qualiStartsInTriggerFlow.trigger(raceObject, {time: "60"} );
			}, (timeDelta - (60 * MINUTE)) );
		}
	}

	async setTimerBeforeRaceStart() {
		if (this.nextRace) {
			this.raceStartTime = new Date(`${this.nextRace.date}T${this.nextRace.time}`);

			const timeDelta = (this.raceStartTime.getTime() - Date.now());

			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; 			  // We don't want to trigger after the race has started

			this.log('Setting timers for race_in trigger with timeout', (timeDelta / 1000 / 60));

			const raceObject = {
				race_name: this.nextRace.raceName,
				circuit: this.nextRace.circuit,
			}

			// Clear timeouts and check if the time remaining to the race is longer then the time to trigger
			if (this.fiveMinRaceTimeout) clearTimeout(this.fiveMinRaceTimeout);
			if (timeDelta >= (5 * MINUTE)) this.fiveMinRaceTimeout = setTimeout(() => {
				this.log('Triggering 5 minutes start timer');
				// Trigger the flow and create token data
				this.raceStartsInTriggerFlow.trigger(raceObject, {time: "5"} );
			}, (timeDelta - (5 * MINUTE)) );
			
			if (this.tenMinRaceTimeout) clearTimeout(this.tenMinRaceTimeout);
			if (timeDelta >= (10 * MINUTE)) this.tenMinRaceTimeout = setTimeout(() => {
				this.log('Triggering 10 minutes start timer');
				this.raceStartsInTriggerFlow.trigger(raceObject, {time: "10"} );
			}, (timeDelta - (10 * MINUTE)) );

			if (this.thirtyMinRaceTimeout) clearTimeout(this.thirtyMinRaceTimeout);
			if (timeDelta >= (30 * MINUTE)) this.thirtyMinRaceTimeout = setTimeout(() => {
				this.log('Triggering 30 minutes start timer');
				this.raceStartsInTriggerFlow.trigger(raceObject, {time: "30"} );
			}, (timeDelta - (30 * MINUTE)) );

			if (this.sixtyMinRaceTimeout) clearTimeout(this.sixtyMinRaceTimeout);
			if (timeDelta >= (60 * MINUTE)) this.sixtyMinRaceTimeout = setTimeout(() => {
				this.log('Triggering 60 minutes start timer');
				this.raceStartsInTriggerFlow.trigger(raceObject, {time: "60"} );
			}, (timeDelta - (60 * MINUTE)) );
		}
	}

	async setTimerBeforeSprintRaceStart() {
		if (this.nextRace) {
			this.raceStartTime = new Date(`${this.nextRace.sprint.date}T${this.nextRace.sprint.time}`);
	
			const timeDelta = (this.raceStartTime.getTime() - Date.now());
	
			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; 			  // We don't want to trigger after the race has started
	
			this.log('Setting timers for sprint_in trigger with timeout', (timeDelta / 1000 / 60));
	
			const raceObject = {
				race_name: this.nextRace.raceName,
				circuit: this.nextRace.circuit,
			}
	
			// Clear timeouts and check if the time remaining to the race is longer then the time to trigger
			if (this.fiveMinSprintRaceTimeout) clearTimeout(this.fiveMinSprintRaceTimeout);
			if (timeDelta >= (5 * MINUTE)) this.fiveMinSprintRaceTimeout = setTimeout(() => {
				this.log('Triggering 5 minutes sprint start timer');
				// Trigger the flow and create token data
				this.sprintRaceStartsInTriggerFlow.trigger(raceObject, {time: "5"} );
			}, (timeDelta - (5 * MINUTE)) );
			
			if (this.tenMinSprintRaceTimeout) clearTimeout(this.tenMinSprintRaceTimeout);
			if (timeDelta >= (10 * MINUTE)) this.tenMinSprintRaceTimeout = setTimeout(() => {
				this.log('Triggering 10 minutes start timer');
				this.sprintRaceStartsInTriggerFlow.trigger(raceObject, {time: "10"} );
			}, (timeDelta - (10 * MINUTE)) );
	
			if (this.thirtyMinSprintRaceTimeout) clearTimeout(this.thirtyMinSprintRaceTimeout);
			if (timeDelta >= (30 * MINUTE)) this.thirtyMinSprintRaceTimeout = setTimeout(() => {
				this.log('Triggering 30 minutes start timer');
				this.sprintRaceStartsInTriggerFlow.trigger(raceObject, {time: "30"} );
			}, (timeDelta - (30 * MINUTE)) );
	
			if (this.sixtyMinSprintRaceTimeout) clearTimeout(this.sixtyMinSprintRaceTimeout);
			if (timeDelta >= (60 * MINUTE)) this.sixtyMinSprintRaceTimeout = setTimeout(() => {
				this.log('Triggering 60 minutes start timer');
				this.sprintRaceStartsInTriggerFlow.trigger(raceObject, {time: "60"} );
			}, (timeDelta - (60 * MINUTE)) );
		}
	}

	async triggerWinnerFlow() {
		const nextRace = await this.api.getNextRace();
		if (nextRace) {
			const raceStartTime = new Date(`${nextRace.date}T${nextRace.time}`);

			if (raceStartTime >= TIMER_THRESHOLD) return;

			const refreshTimeOut = raceStartTime.getTime() + AFTER_RACE_TIMEOUT;
			const timeout = refreshTimeOut - Date.now();
			
			if (this.winnerTimeout) clearTimeout(this.winnerTimeout);
			this.winnerTimeout = setTimeout(async () => {
				const winnerData = await this.api.getWinner();
				this.log("Triggering winner flow");
				this.raceWonByTriggerFlow.trigger({
					driver_name: `${winnerData.givenName} ${winnerData.familyName}`,
				})
			}, timeout);
		}
	}

	async isRaceOngoing() {
		const nextRace = await this.api.getNextRace();
			if (nextRace) {
			const raceStartTime = new Date(`${nextRace.date}T${nextRace.time}`);

			const refreshTimeOut = raceStartTime.getTime() + AFTER_RACE_TIMEOUT;
			const timeout = refreshTimeOut - Date.now();

			if (timeout > 0 && timeout <= RACE_DURATION) return true;
			else return false;
			}
	}

	async createDriverStandingTokens() {
		// Use the current standings to get the current amount of drivers in the season.
		const standings = await this.api.getDriverStandings();
		if (standings && (standings.length != this.driverStandingTokens.length)) {
			for (var counter = 0; counter <= standings.length; counter++) {
				this.driverStandingTokens.push(
					await this.homey.flow.createToken(`standing_${counter}`, {
						type: 'string',
						title: `Position ${1 + counter}`
					})
				);
			}
		}
	}

	async fillDriverStandingTokens() {
		const standings = await this.api.getDriverStandings();
		if (standings) {
			var counter = 0;
			if (standings) {
				standings.forEach(standing => {
					this.driverStandingTokens[counter].setValue(`${standing.position}. ${standing.givenName} ${standing.familyName}`);
					counter++;
				});
			}
		}
	}
}

module.exports = FormulaOne;