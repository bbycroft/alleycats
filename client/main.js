var _ = require('lodash');
var d3 = require('d3');

document.addEventListener('DOMContentLoaded', create);

function create() {
    var game = new Game();
    game.update(true);
}

function Game() {
    var self = this;

    self.width = 700;
    self.height = 500;
    self.firstRun = true;

    self.svg = d3.select('#game_container')
        .attr('width', self.width).attr('height', self.height);

    self.xScale = d3.scale.linear().domain([-8, 8]).range([0, self.width]);
    self.yScale = d3.scale.linear().domain([-5, 5]).range([0, self.height]);

    var diceBox = self.svg.append('g')
        .attr("transform", "translate(" + (self.width / 2) + ",60)");

    diceBox.append('rect')
        .attr('width', 50)
        .attr('height', 50)
        .attr('x', -25)
        .attr('y', -25)
        .style('fill', 'white')
        .style('stroke', 'black')
        .style('cursor', 'pointer')
        .on('click', function () {
            self.gameState.diceRoll = Math.floor(Math.random() * 6) + 1;
            self.update();
        });

    diceBox.append('text')
        .attr('id', 'diceRollText')
        .attr('text-anchor', 'middle')
        .attr('dy', '.35em')
        .style('font-size', '200%')
        .style('pointer-events', 'none')
        .text('click');

    var left = -3;
    var right = 3;

    self.gameLayout = {
        points: [
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

        trail_a: ['a0', 'a1', 'a2', 'c0', 'c1', 'c2', 'c3', 'c4', 'a3', 'a4', 'a5'],
        trail_b: ['b0', 'b1', 'b2', 'c0', 'c1', 'c2', 'c3', 'c4', 'b3', 'b4', 'b5'],

        endpoints: [
            { x: left - 4.5, y: 3, loc: 'start', team: 'a' },
            { x: left - 4.5, y: -3, loc: 'start', team: 'b' },
            { x: right + 4.5, y: 3, loc: 'end', team: 'a' },
            { x: right + 4.5, y: -3, loc: 'end', team: 'b' },
        ],
        endpoint_spacing: 0.5,
    };

    self.gameState = {
        cats: [],
        team_a: {},
        team_b: {},
        selectedCat: null,
        transitionLock: false,
        diceRoll: 1,
    };

    _.each(_.range(6), function (i) {
        self.gameState.cats.push({ id: 'a' + i, team: 'a', loc: 'start' });
        self.gameState.cats.push({ id: 'b' + i, team: 'b', loc: 'start' });
    }, self);

    self.update();
}

Game.prototype.update = function (firstRun) {
    var self = this;
    var transitionTime = firstRun ? 0 : 300;

    // dice roll widget
    self.svg.select('#diceRollText')
        .text('' + this.gameState.diceRoll);

    // circles to land on
    var circlesJoin = self.svg.selectAll('.game_circle')
        .data(self.gameLayout.points, function (d) { return d.id; });

    circlesJoin.enter()
        .append('circle')
        .attr('class', 'game_circle');

    circlesJoin
        .transition().duration(transitionTime)
        .attr('cx', function (d) { return self.xScale(d.x); })
        .attr('cy', function (d) { return self.yScale(d.y); })
        .attr('r', 30);

    circlesJoin.exit().remove();

    // cats
    var catAdaptors = _.map(self.gameState.cats, this.catDisplayAdaptor.bind(this));

    var catsJoin = self.svg.selectAll('.game_cat')
        .data(catAdaptors, function (d) { return d.id; });

    catsJoin.enter()
        .append('circle')
        .attr('class', 'game_cat')
        .style('cursor', 'pointer')
        .on('click', function (catAdaptor) {
            if (self.gameState.transitionLock) {
                return;
            }

            self.gameState.selectedCat = catAdaptor.id;

            if (catAdaptor.canMove) {
                catAdaptor.cat.loc = catAdaptor.nextLocTarget;
            }
            self.update();
        });

    catsJoin
        .transition().duration(transitionTime)
        .style('fill', function (d) { return d.color.darker(0.5); })
        .style('stroke', function (d) { return d.color.darker(1); })
        .attr('r', 10)
        .attr('cx', function (d) { return self.xScale(d.x); })
        .attr('cy', function (d) { return self.yScale(d.y); });

    catsJoin.exit().remove();

    self.gameState.transitionLock = true;
    setTimeout(function () {
        self.gameState.transitionLock = false;
    }, transitionTime);
};

Game.prototype.catDisplayAdaptor = function (cat) {
    var self = this;
    var target = _.find(self.gameLayout.endpoints, { loc: cat.loc, team: cat.team });
    var offset = 0;

    if (target) {
        var catsAtSameTarget = _.pluck(_.where(self.gameState.cats, { loc: cat.loc, team: cat.team }), 'id');
        var numCats = catsAtSameTarget.length;
        var index = _.indexOf(catsAtSameTarget, cat.id);
        var spacing = self.gameLayout.endpoint_spacing;
        offset = ((catsAtSameTarget.length - 1) * spacing * 0.5) - (index * spacing);
    } else {
        target = _.find(self.gameLayout.points, { id: cat.loc });
    }

    var nextLoc = self.getNextLocation(cat, self.gameState.diceRoll);

    return {
        id: cat.id,
        x: target.x,
        y: target.y + offset,
        target: target,
        cat: cat,
        nextLocTarget: nextLoc.target,
        canMove: nextLoc.canMove,
        color: d3.rgb(cat.team === 'a' ? 'red' : 'green'),
    };
};

Game.prototype.getNextLocation = function (cat, numSteps) {
    var self = this;

    if (cat.loc === 'end') {
        return { target: null, canMove: false };
    }

    var trail = self.gameLayout['trail_' + cat.team];

    // using indexOf == -1 if at start
    var targetTrailIndex = _.indexOf(trail, cat.loc) + numSteps;

    if (targetTrailIndex >= trail.length) {
        return { target: 'end', canMove: true };
    }

    var target = trail[targetTrailIndex];
    var friendCatAtTarget = _.find(self.gameState.cats, { loc: target, team: cat.team });
    return { target: target, canMove: !friendCatAtTarget };
};
