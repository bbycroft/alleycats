var util = require('util');
var events = require('events');
var when = require('when');
var _ = require('lodash');
var d3 = require('d3');
var Sprite = require('./sprite');
var GameState = require('./gameState');

document.addEventListener('DOMContentLoaded', create);

function create() {
    var catSprite1_p = Sprite.createSprite('cat_a.svg', 'cat_a');
    var catSprite2_p = Sprite.createSprite('cat_b.svg', 'cat_b');

    when.all([catSprite1_p, catSprite2_p])
        .then(function (sprites) {
            var view = new GameView(sprites);
            var controller = new GameController(view);
            // controller.onStartGameClicked();
            controller.queueUpdate();
        });
}

function GameController(view) {
    var self = this;

    self.view = view;

    self.view.on('gameStateClicked', self.onGameStateClicked.bind(self));
    self.view.on('catClicked', self.onCatClicked.bind(self));

    self.mode = 'start_page'; // 'start_page', 'player_turn', 'move_executing', 'player_win'
    self.currentGame = null;

    // applicable during { mode: 'player_turn' }
    self.turn = 0;
    self.currentTeam = null;
    self.diceRoll = 5;

    self.gameSettings = {
        numCats: 6,
        trails: {
            'a': ['a0', 'a1', 'a2', 'c0', 'c1', 'c2', 'c3', 'c4', 'a3', 'a4', 'a5'],
            'b': ['b0', 'b1', 'b2', 'c0', 'c1', 'c2', 'c3', 'c4', 'b3', 'b4', 'b5'],
        },
        safeLocations: [],
    };
    self.teams = _.keys(self.gameSettings.trails);
    self.updateQueued = false;
}

/** functions that update state and queue an update */

GameController.prototype.nextPlayerTurn = function () {
    var self = this;
    self.winningTeam = self.currentGame.getWinningTeam();

    if (self.winningTeam) {
        self.mode = 'player_win';
    } else {
        self.mode = 'player_turn';
        self.currentTeam = self.teams[self.turn % self.teams.length];
        self.diceRoll = Math.floor(Math.random() * 6) + 1;
        self.turn += 1;
    }

    self.queueUpdate();
};

GameController.prototype.moveCat = function (cat) {
    var self = this;
    self.currentGame.moveCat(cat.id, self.diceRoll);
    self.mode = 'move_executing';
    // self.view.animateCatMove(cat)
    self.nextPlayerTurn();
};

GameController.prototype.onCancelGameClicked = function () {
    var self = this;
    self.mode = 'start_page';
    self.queueUpdate();
};

GameController.prototype.onGameStateClicked = function () {
    var self = this;
    if (self.mode === 'start_page') {
        self.onStartGameClicked();
    }
};

GameController.prototype.onStartGameClicked = function () {
    var self = this;

    self.currentGame = new GameState(self.gameSettings);

    self.nextPlayerTurn();
    self.queueUpdate();
};

GameController.prototype.onCatHover = function (isEnter, cat) {
    var self = this;
    
};

GameController.prototype.onCatClicked = function (cat) {
    console.log('cat clicked');
    var self = this;
    if (self.mode !== 'player_turn' || cat.team !== self.currentTeam) {
        return; // or do angry-cat animation
    } else if (cat.canMove) {
        self.moveCat(cat);
    } else {
        // do shy-cat animation
    }
};

GameController.prototype.queueUpdate = function () {
    var self = this;
    if (self.updateQueued) {
        return;
    }
    setTimeout(self._update.bind(self), 0);
};

GameController.prototype._update = function () {
    var self = this;
    var catAdaptors = [];

    if (self.currentGame) {
        var cats = self.currentGame.getCats();
        var nextMoves = _.mapKeys(self.currentGame.getPossibleMoves(self.currentTeam, self.diceRoll), 'catId');
        var catsAtLocation = _.groupBy(cats, 'loc');

        catAdaptors = _.map(cats, function (cat) {
            return self._getCatAdaptor(cats, cat, nextMoves[cat.id], catsAtLocation);
        });
    }

    self.view.update({
        mode: self.mode,
        winningTeam: self.winningTeam,
        currentTeam: self.currentTeam,
        diceRoll: self.diceRoll,
        turn: self.turn,
        catAdaptors: catAdaptors,
        startPageVisible: self.mode === 'start_page',
        restartVisible: self.mode === 'start_page' && self.turn > 0,
        cancelVisible: self.mode === 'player_turn' || self.mode === 'move_executing',
    });
};

GameController.prototype._getCatAdaptor = function (cats, cat, nextMove, catsAtLocation) {
    var self = this;
    var target = _.find(self.view.gameLayout.endLocations, { loc: cat.loc, team: cat.team });
    var offset = 0;

    if (target) {
        var catsAtSameTarget = _.pluck(_.where(cats, { loc: cat.loc, team: cat.team }), 'id');
        var numCats = catsAtSameTarget.length;
        var index = _.indexOf(catsAtSameTarget, cat.id);
        var spacing = self.view.gameLayout.endLocationSpacing;
        offset = ((catsAtSameTarget.length - 1) * spacing * 0.5) - (index * spacing);
    } else {
        target = _.find(self.view.gameLayout.locations, { id: cat.loc });
    }

    console.log(nextMove, nextMove ? nextMove.canMove : false);

    return {
        id: cat.id,
        team: cat.team,
        loc: cat.loc,
        cat: cat,
        x: target.x,
        y: target.y + offset,
        canMove: nextMove ? nextMove.canMove : false,
    };
};

util.inherits(GameView, events.EventEmitter);

function GameView(sprites) {
    var self = this;

    var left = -3;
    var right = 3;

    self.gameLayout = {
        locations: [
            { id: 'a0', x: left - 3, y: 3 },
            { id: 'a1', x: left - 2, y: 2 },
            { id: 'a2', x: left - 1, y: 1 },

            { id: 'b0', x: left - 3, y: -3 },
            { id: 'b1', x: left - 2, y: -2 },
            { id: 'b2', x: left - 1, y: -1 },

            { id: 'c0', x: left + 0, y: 0 },
            { id: 'c1', x: left + 1.5, y: 0 },
            { id: 'c2', x: left + 3, y: 0 },
            { id: 'c3', x: left + 4.5, y: 0 },
            { id: 'c4', x: left + 6, y: 0 },

            { id: 'a3', x: right + 1, y: 1 },
            { id: 'a4', x: right + 2, y: 2 },
            { id: 'a5', x: right + 3, y: 3 },

            { id: 'b3', x: right + 1, y: -1 },
            { id: 'b4', x: right + 2, y: -2 },
            { id: 'b5', x: right + 3, y: -3 },
        ],

        endLocations: [
            { loc: 'start', team: 'a', x: left - 4.5, y: 3 },
            { loc: 'start', team: 'b', x: left - 4.5, y: -3 },
            { loc: 'end', team: 'a', x: right + 4.5, y: 3 },
            { loc: 'end', team: 'b' , x: right + 4.5, y: -3 },
        ],
        endLocationSpacing: 0.5,
    };

    self.width = 700;
    self.height = 500;

    self.xScale = d3.scale.linear().domain([-8, 8]).range([0, self.width]);
    self.yScale = d3.scale.linear().domain([5, -5]).range([0, self.height]);

    self.gameArea = d3.select('#gameArea');

    self.gameArea.select('#gameStateText')
        .on('click', self.emit.bind(self, 'gameStateClicked'));

    // cat definitions
    d3.select('#svgDefs > defs').selectAll('g')
        .data(sprites)
        .enter()
        .select(function (d) {
            console.log(d);
            return this.appendChild(this.ownerDocument.importNode(d.dom, true));
        });

    // circles to land on
    self.gameArea.select('#gameCircles')
        .selectAll('.gameCircle')
        .data(self.gameLayout.locations, function (d) { return d.id; })
      .enter()
        .append('circle')
        .attr('class', 'gameCircle')
        .attr('cx', function (d) { return self.xScale(d.x); })
        .attr('cy', function (d) { return self.yScale(d.y); })
        .attr('r', 30);
}

GameView.prototype.update = function (viewState) {
    var self = this;
    var transitionTime = 300;

    // dice roll widget
    var text = self.getGameStateText(viewState);
    console.log(text);
    self.gameArea.select('#gameStateText')
        .text(text);

    // cats
    var catsJoin = self.gameArea.select('#gameCats')
        .selectAll('.gameCat')
        .data(viewState.catAdaptors, function (d) { return d.id; });

    var catsEnter = catsJoin.enter()
        .append('use')
        .attr('xlink:href', function (d) { return '#cat_' + d.cat.team; })
        .style('cursor', 'pointer')
        .attr('class', 'gameCat')
        .on('click', self.emit.bind(self, 'catClicked'))
        .on('mouseenter', self.emit.bind(self, 'catHover', true))
        .on('mouseleave', self.emit.bind(self, 'catHover', false));

    catsJoin
        .style('cursor', function (d) { return d.canMove ? 'pointer' : 'default'; })
        .transition().duration(transitionTime)
        .attr('transform', function (d) { return 'translate(' + self.xScale(d.x) + ', ' + self.yScale(d.y) + ')'; });

    catsJoin.exit().remove();
};

GameView.prototype.getGameStateText = function (viewState) {
    var self = this;

    if (viewState.mode === 'start_page') {
        return 'Click to Begin';
    }

    return util.format('Team %s rolled a %d',
        viewState.currentTeam.toUpperCase(),
        viewState.diceRoll);
};

/*
Game.prototype.updatePotentialMovement = function () {
    var self = this;

    var lineGen = d3.svg.line()
        .x(function (d) { return self.xScale(d.x); })
        .y(function (d) { return self.yScale(d.y); });

    if (self.gameState.hoverCat) {
        var nextLoc = self.getNextLocation(self.gameState.hoverCat, self.gameState.diceRoll);
        self.svg.select('#potential_path')
            .attr('d', lineGen(nextLoc.path))
            .attr('stroke', nextLoc.canMove ? '#00a600' : '#535353')
    }

    self.svg.select('#potential_path')
        .attr('opacity', self.gameState.hoverCat ? 1.0 : 0.0);
};
*/
