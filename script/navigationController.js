var controller = module.exports = function($scope, $location, $rootScope, $window){
	$scope.getClass = function (page) {
		var currentRoute = $location.path().substring(1);
		return page === currentRoute ? 'active' : '';
    };  
};
controller.$inject = ['$scope', '$location', '$rootScope', '$window'];
