
var when = require('when');
var nodefn = require('when/node');
var d3 = require('d3');

var d3xml_p = nodefn.lift(d3.xml.bind(d3));

function Sprite(dom) {
    this.dom = dom;
}

Sprite.createSprite = function (url, group) {
    return d3xml_p(url, 'image/svg+xml')
        .then(function (xmlDoc) {
            var dom = xmlDoc.documentElement.getElementById(group);
            return new Sprite(dom);
        });
};

module.exports = Sprite;
