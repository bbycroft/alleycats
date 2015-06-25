var _ = require('lodash');
/*
 * The internal model of the alley-cats game. It contains the business
 * logic and update procedure.
 *
 * to use:
 *
 * 1) instantiate with config (all <locs> are strings, except 'start' or 'end', which are reserved)
 *      {
            numCats: <int>,
            trails: { <trail>: [<locs>] },
            safeLocations: [<locs>],
        }
 *
 * 2) call getCats() to get all current cats and their locations
 * 3) call getPossibleMoves(team, diceRoll) to get all valid moves for the current team
 * 4) call getWinningTeam() to check if any team has won yet
 * 5) call moveCat(catId, diceRoll) for one of the cats with { canMove: true }
 *
 * To replay, call getHistory() on the current game. Then call
 *      moveCat(hist[i].catId, hist[i].numSteps)
 * on a new game repeatedly.
*/
function GameState(config) {
    var self = this;

    self.teams = _.keys(config.trails);
    self.trails = config.trails;
    self.safeLocations = config.safeLocations;

    self.cats = _(_.range(config.numCats))
        .map(function (i) {
            return _.map(self.teams, function (team) {
                return { id: team + i, team: team, loc: 'start' };
            });
        })
        .flatten()
        .value();

    self.history = []; // { catId: <string>, numSteps: <int> }
}

GameState.prototype.getHistory = function () {
    var self = this;
    return self.history;
}

GameState.prototype.getCats = function () {
    var self = this;
    return self.cats;
};

// returns the team that won, or null if no team has won yet
GameState.prototype.getWinningTeam = function () {
    var self = this;
    var winningTeam = null;
    _.each(self.teams, function (team) {
        var catsOnTeam = _.find(self.cats, { team: team });
        if (_.every(catsOnTeam, { loc: 'end' })) {
            winningTeam = team;
        }
    });
    return winningTeam;
};

GameState.prototype.getPossibleMoves = function (team, numSteps) {
    var self = this;
    return _(self.cats)
        .filter({ team: team })
        .map(function (cat) {
            return self._getPossibleMove(cat.id, numSteps);
        })
        .value();
};

GameState.prototype.moveCat = function (catId, numSteps) {
    var self = this;
    var cat = _.find(self.cats, { id: catId });

    var movement = self._getPossibleMove(catId, numSteps);
    cat.loc = movement.dest;

    if (movement.catIdAtDest) {
        var catAtDest = _.find(self.cats, { id: movement.catIdAtDest });
        catAtDest.loc = 'start';
    }

    self.history.push({ catId: catId, numSteps: numSteps });
};

GameState.prototype._getPossibleMove = function (catId, numSteps) {
    var self = this;
    var cat = _.find(self.cats, { id: catId });

    if (cat.loc === 'end') {
        return { catId: catId, dest: null, canMove: false, path: [], catIdAtDest: null };
    }

    var trail = self.trails[cat.team];

    // using indexOf == -1 if at start
    var startIndex = _.indexOf(trail, cat.loc);
    var endIndex = startIndex + numSteps;

    var path = [];
    for (var i = startIndex; i <= endIndex; i++) {
        if (i === -1) {
            path.push('start');
        } else if (i < trail.length) {
            path.push(trail[i]);
        } else {
            path.push('end');
            break;
        }
    }

    if (endIndex >= trail.length) {
        return { catId: catId, dest: 'end', canMove: true, path: path, catIdAtDest: null };
    }

    var dest = trail[endIndex];
    var catAtDest = _.find(self.cats, { loc: dest }) || null;

    var canMove = self._catCanMoveToTrailLocation(cat, dest, catAtDest);

    return { catId: catId, dest: dest, canMove: canMove, path: path, catIdAtDest: catAtDest ? catAtDest.id : null };
};

GameState.prototype._catCanMoveToTrailLocation = function (cat, dest, catAtDest) {
    if (!catAtDest) {
        return true;
    }

    // there is a cat! can only move if other teams cat is there and it's not a safe location
    return !_.contains(self.safeLocations, dest) && catAtDest.team != cat.team;
}

module.exports = GameState;
