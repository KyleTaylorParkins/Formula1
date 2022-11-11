'use strict'

const fetch = require('node-fetch');

const CACHE_TIMEOUT = 5 * 60 * 1000; // 5 minutes in miliseconds

module.exports = class FormulaOneApi {
    constructor(test) {
        this._test = test;
        this.cachedNextRace = null;
        this.cachedDriverStandings = null;
        this.log(`Created new F1 ergast API, test mode: ${this._test}`);
    }

    async log(msg) {
        console.log(`[api] ${msg}`);
    }
    
    async apiCall(path) {
        const server = this._test ? '192.168.22.158' : 'ergast.com';
        const url = `http://${server}/api/f1/${path}.json`;
        this.log(`Fetching: ${url}`);

        return fetch(url)
        .then(async res => {
            const json = await res.json();
            return json;
        })
        .catch(err => {
            this.log(`Error in api call: ${err.code}`);
            return null;
        });
    }

    async getNextRace() {
        if (this.cachedNextRace != null) {
            if ((Date.now() - this.cachedNextRace.refreshTime) < CACHE_TIMEOUT) {
                this.log('Returning race from cache');
                return this.cachedNextRace;
            }
        }

        const json = await this.apiCall('current/next');
        if (json === null) return null;

        const race = json.MRData.RaceTable.Races[0];
        this.log(`Next race: ${race.raceName} @ ${race.date}`);

        this.cachedNextRace = {
            raceName: race.raceName,
            round: race.round,
            circuit: race.Circuit.circuitName,
            country: race.Circuit.Location.country,
            date: race.date,
            time: race.time,
            qualifying: race.Qualifying,
            sprint: race.Sprint,
            refreshTime: Date.now(),
        }
        return this.cachedNextRace;
    }

    async getWinner(race = 'last') {
        const json = await this.apiCall(`current/${race}/results`);
        const winner = json.MRData.RaceTable.Races[0].Results[0].Driver;
        // console.log(`Last race (${lastRace}) is won by ${winner.familyName}`);
        return {
            givenName: winner.givenName,
            familyName: winner.familyName,
        }
    }

    async getTopThree(race = 'last') {
        const json = await this.apiCall(`current/${race}/results`);
        const results = [];
        json.MRData.RaceTable.Races[0].Results.forEach(result => {
            if (result.position > 3) return;
            results.push({
                postion: result.position,
                givenName: result.Driver.givenName,
                familyName: result.Driver.familyName,
            });
       });

       return results;
    }

    async getDriverStandings() {
        if (this.cachedDriverStandings != null) {
            if ((Date.now() - this.cachedDriverStandings.refreshTime) < CACHE_TIMEOUT) {
                return this.cachedDriverStandings.standings;
            }
        }

        const json = await this.apiCall(`current/driverStandings`);
        const results = [];
        json.MRData.StandingsTable.StandingsLists[0].DriverStandings.forEach(standing => {
            results.push({
                position: standing.position,
                givenName: standing.Driver.givenName,
                familyName: standing.Driver.familyName,
            });
       });

       this.cachedDriverStandings = {
           standings: results,
           refreshTime: Date.now(),
       }
       return results;
    }
}