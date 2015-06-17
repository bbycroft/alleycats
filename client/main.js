var _ = require('lodash');
var d3 = require('d3');

document.addEventListener('DOMContentLoaded', app);

function app() {
    _.each([1, 2, 54, 56, 3], function (x) {
        console.log('value is ' + x);
    });
    d3.select('body').append('p').text('~ appended by d3 after DOM loaded ~');
}
