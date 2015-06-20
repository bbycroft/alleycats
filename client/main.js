var _ = require('lodash');
var d3 = require('d3');

document.addEventListener('DOMContentLoaded', create);

function create() {
    d3.xml('cat_template.svg', 'image/svg+xml', function (xml) {
        var catXml = xml.documentElement.getElementById('layer1');
        walkDOM(catXml, function (node) {
            if (!node.hasAttribute || !node.style) {
                return;
            }
            if (node.hasAttribute('id')) {
                node.removeAttribute('id');
            }
            if (d3.rgb(node.style.fill).toString() === '#ff7f2a') {
                node.style.fill = '';
            }
        });
        var game = new Game(catXml);
        game.update(true);
    });
}

function walkDOM(node, func) {
    func(node);
    node = node.firstChild;
    while (node) {
        walkDOM(node, func);
        node = node.nextSibling;
    }
};

function Game(catXml) {
    var self = this;

    self.width = 700;
    self.height = 500;
    self.catXml = catXml;

    self.svg = d3.select('#game_container')
        .attr('width', self.width).attr('height', self.height);

    self.xScale = d3.scale.linear().domain([-8, 8]).range([0, self.width]);
    self.yScale = d3.scale.linear().domain([-5, 5]).range([0, self.height]);

    var diceBox = self.svg.append('g')
        .attr('transform', 'translate(' + (self.width / 2) + ',60)');

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
        hoverCat: null,
        transitionLock: false,
        inGame: false,
        currentTeam: null,
        diceRoll: 5,
    };

    _.each(_.range(6), function (i) {
        self.gameState.cats.push({ id: 'a' + i, team: 'a', loc: 'start' });
        self.gameState.cats.push({ id: 'b' + i, team: 'b', loc: 'start' });
    }, self);

    self.update(true);
}

Game.prototype.update = function (firstRun) {
    var self = this;
    var transitionTime = firstRun ? 0 : 300;

    // dice roll widget
    self.svg.select('#diceRollText')
        .text('' + this.gameState.diceRoll);

    // circles to land on
    var circlesJoin = self.svg.select('#game_circles')
        .selectAll('.game_circle')
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

    var catsJoin = self.svg.select('#game_cats')
        .selectAll('.game_cat')
        .data(catAdaptors, function (d) { return d.id; });

    var catsEnter = catsJoin.enter()
        .select(function() {
            return this.appendChild(this.ownerDocument.importNode(self.catXml, true));
        })
        .style('cursor', 'pointer')
        .attr('class', function (d) {
            return 'game_cat team_' + d.cat.team;
        })
        .on('click', function (d) {
            if (self.gameState.transitionLock) {
                return;
            }

            if (d.canMove) {
                d.cat.loc = d.nextLocTarget;
            }
            self.update();
        })
        .on('mouseenter', function (d) {
            self.gameState.hoverCat = d.cat;
            self.updatePotentialMovement();
        })
        .on('mouseleave', function (d) {
            self.gameState.hoverCat = null;
            self.updatePotentialMovement();
        });

    catsJoin
        .transition().duration(transitionTime)
        .attr('transform', function (d) { return 'translate(' + self.xScale(d.x) + ',' + self.yScale(d.y) + ')'; });

    catsJoin.exit().remove();

    self.gameState.transitionLock = true;
    setTimeout(function () {
        self.gameState.transitionLock = false;
    }, transitionTime);
};

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
        return { target: null, canMove: false, path: [] };
    }

    var trail = self.gameLayout['trail_' + cat.team];

    // using indexOf == -1 if at start
    var startIndex = _.indexOf(trail, cat.loc);
    var endIndex = startIndex + numSteps;

    var path = [];
    for (var i = startIndex; i <= endIndex; i++) {
        if (i == -1) {
            path.push(_.find(self.gameLayout.endpoints, { loc: 'start', team: cat.team }));
        } else if (i < trail.length) {
            path.push(_.find(self.gameLayout.points, { id: trail[i] }));
        } else {
            path.push(_.find(self.gameLayout.endpoints, { loc: 'end', team: cat.team }));
            break;
        }
    }

    if (endIndex >= trail.length) {
        return { target: 'end', canMove: true, path: path };
    }

    var target = trail[endIndex];
    var friendCatAtTarget = _.find(self.gameState.cats, { loc: target, team: cat.team });
    return { target: target, canMove: !friendCatAtTarget, path: path };
};
