require('jquery/jquery.js');
require('../resource/bootstrap.min.js');
require('../resource/prettify.js');
require('angular/angular.js');
require('../resource/angularstrap.js');

var app = angular.module('oztu', ['$strap.directives']);
app.controller('pages', require('./pagesController.js'));
app.controller('navigation', require('./navigationController.js'));

app.value('$anchorScroll', angular.noop); 

app.config(['$routeProvider', function($routeProvider){
	$routeProvider.otherwise({
		templateUrl: 'post/about/index.htm'
	}).when('/walkthrough', {
		templateUrl: 'post/walkthrough/index.htm'
	}).when('/cookbook', {
		templateUrl: 'post/cookbook/index.htm'
	}).when('/use', {
		templateUrl: 'post/use/index.htm'
	}).when('/contribute', {
		templateUrl: 'post/contribute/index.htm'
	}).when('/party-example', {
		templateUrl: 'post/party-example/index.htm'
	});
}]);
