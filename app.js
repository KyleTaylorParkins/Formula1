'use strict';

const Homey			= require('homey');
const FormulaOneApi = require('./lib/FormulaOneApi');

const AFTER_RACE_TIMEOUT	= 3		* 60 * 60 * 1000;		// 3 hours timeout for after the race
const RACE_DURATION			= 2		* 60 * 60 * 1000;		// 2 hours in which the race should be finished
const DATA_REFRESH_TIMEOUT	= 24	* 60 * 60 * 1000;		// 24 hours data refresh
const TIMER_THRESHOLD		= 2* 24 * 60 * 60 * 1000;		// 2 Days threshold for timers
const TEST_REFRESH			= 5			 * 60 * 1000;		// 5 minute test timeout

class FormulaOne extends Homey.App {
	
	async onInit() {
		this.api = new FormulaOneApi();

		this.test = true;

		// Create the Flows
    	this.raceStartTriggerFlow = this.homey.flow.getTriggerCard('race_start');

		this.raceStartsInTriggerFlow = this.homey.flow.getTriggerCard('race_in');
		this.raceStartsInTriggerFlow.registerRunListener(async (args, state) => {
			if (args.time_before == state.time) return true;
			else return false;
		});

		this.qualiStartsInTriggerFlow = this.homey.flow.getTriggerCard('qualifying_in');
		this.qualiStartsInTriggerFlow.registerRunListener(async (args, state) => {
			if (args.time_before == state.time) return true;
			else return false;
		});

		this.raceWonByTriggerFlow = this.homey.flow.getTriggerCard('winner');

		this.isRacingConditionFlow = this.homey.flow.getConditionCard('is_racing');
		this.isRacingConditionFlow.registerRunListener(async (args, state) => {
			return this.isRaceOngoing();
		})

		this.nextRace = await this.api.getNextRace();
	
		// Set Flow timeout
		this.setTimerRaceStart();
		this.setTimerBeforeQualifyingStart();
		this.triggerWinnerFlow();

		// Create app tokens
		this.driverStandingTokens = [];
		await this.createDriverStandingTokens();
		this.fillDriverStandingTokens();

		// Updater loopje
		const updaterTimeout = this.test ? TEST_REFRESH : DATA_REFRESH_TIMEOUT;
		this.log(`Using update timeout: ${updaterTimeout}`);
		this.updaterLoop = setInterval(async() => {
			this.log('Updating data from API');
			this.nextRace = await this.api.getNextRace();

			// Update all elements
			this.fillDriverStandingTokens();
			this.setTimerRaceStart();
			this.setTimerBeforeQualifyingStart();
			this.triggerWinnerFlow();
		}, updaterTimeout);
	}

	// Helper function to create Flow Trigger timers
	async getTimerFlowTrigger(flowTrigger, timeout) {
		this.log(`Setting timer for ${timeout} minutes @ ${flowTrigger}`);
		const timeDelta = (this.raceStartTime.getTime() - Date.now());
        var timerTemp = setTimeout(() => {
            flowTrigger.trigger({
                race_name: this.nextRace.raceName,
				circuit: this.nextRace.circuit,
            }, { time: `${timeout}` });
        }, timeDelta - (timeout * 60 * 1000));
		return timerTemp;
    }

	async setTimerRaceStart() {
		// this.nextRace = await this.api.getNextRace();
		if (this.nextRace) { // todo handle reject/result?
			this.raceStartTime = new Date(`${this.nextRace.date}T${this.nextRace.time}`);

			const timeDelta = (this.raceStartTime.getTime() - Date.now());

			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; // We don't want to trigger after the race has started

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
			this.raceStartTime = new Date(`${this.nextRace.date}T${this.nextRace.time}`);

			const timeDelta = (this.raceStartTime.getTime() - Date.now());

			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; // We don't want to trigger after the race has started

			this.log('Setting timers for before_start trigger with timeout', timeDelta);

			if (this.fiveMinQualiTimeout) clearTimeout(this.fiveMinRaceTimeout);
			this.fiveMinQualiTimeout = this.getTimerFlowTrigger(this.qualiStartsInTriggerFlow, 5);
			
			if (this.tenMinQualiTimeout) clearTimeout(this.tenMinRaceTimeout);
			this.tenMinQualiTimeout = this.getTimerFlowTrigger(this.qualiStartsInTriggerFlow, 10);

			if (this.thirtyMinQualiTimeout) clearTimeout(this.thirtyMinRaceTimeout);
			this.thirtyMinQualiTimeout = this.getTimerFlowTrigger(this.qualiStartsInTriggerFlow, 30);

			if (this.sixtyMinQualiTimeout) clearTimeout(this.sixtyMinRaceTimeout);
			this.sixtyMinQualiTimeout = this.getTimerFlowTrigger(this.qualiStartsInTriggerFlow, 60);
		}
	}

	async setTimerRaceStart() {
		// this.nextRace = await this.api.getNextRace();
		if (this.nextRace) {
			this.raceStartTime = new Date(`${this.nextRace.date}T${this.nextRace.time}`);

			const timeDelta = (this.raceStartTime.getTime() - Date.now());

			if (timeDelta >= TIMER_THRESHOLD) return; // Don't set timer longer then 2 days before the race.
			if (timeDelta <= 0) return; // We don't want to trigger after the race has started

			this.log('Setting timers for before_quali_start trigger with timeout', timeDelta);

			if (this.fiveMinRaceTimeout) clearTimeout(this.fiveMinRaceTimeout);
			this.fiveMinRaceTimeout = this.getTimerFlowTrigger(this.raceStartsInTriggerFlow, 5);
			
			if (this.tenMinRaceTimeout) clearTimeout(this.tenMinRaceTimeout);
			this.tenMinRaceTimeout = this.getTimerFlowTrigger(this.raceStartsInTriggerFlow, 10);

			if (this.thirtyMinRaceTimeout) clearTimeout(this.thirtyMinRaceTimeout);
			this.thirtyMinRaceTimeout = this.getTimerFlowTrigger(this.raceStartsInTriggerFlow, 30);

			if (this.sixtyMinRaceTimeout) clearTimeout(this.sixtyMinRaceTimeout);
			this.sixtyMinRaceTimeout = this.getTimerFlowTrigger(this.raceStartsInTriggerFlow, 60);
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