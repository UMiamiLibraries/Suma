'use strict';

angular.module('sumaAnalysis')
  .controller('ReportCtrl', function ($anchorScroll, $location, $q, $scope, $timeout, promiseTracker, actsLocs, data, initiatives, scopeUtils, sumaConfig, uiStates) {
    var CONFIG,
      DATA_TIMEOUT_PROMISE,
      INIT_TIMEOUT_PROMISE,
      INIT_TRACKER;

    // Initialize controller
    $scope.initialize = function () {
      var urlParams = $location.search();

      // Get report specific configs
      CONFIG = sumaConfig.getConfig($location.path());

      // Resolve active requests
      if (DATA_TIMEOUT_PROMISE) {
        DATA_TIMEOUT_PROMISE.resolve('resolved');
      }

      if (INIT_TIMEOUT_PROMISE) {
        INIT_TIMEOUT_PROMISE.resolve('resolved');
        INIT_TRACKER.cancel();
      }

      if (_.isEmpty(urlParams)) { // Nav to initial
        $scope.getInitiatives().then(function () {
          $scope.state = uiStates.setUIState('initial');
          $scope.params = sumaConfig.setParams(CONFIG);
        }, $scope.error);
      } else if ($scope.params && $scope.params.init) { // Nav between reports (common case)
        $scope.setScope(urlParams)
          .then($scope.getData)
          .then($scope.success, $scope.error)
      } else { // Nav from initial
        $scope.getInitiatives().then(function () {
          $scope.setScope(urlParams)
            .then($scope.getData)
            .then($scope.success, $scope.error);
        }, $scope.error);
      }
    };

    // Set scope.params based on urlParams
    $scope.setScope = function (urlParams) {
      return scopeUtils.set(urlParams, CONFIG, $scope.inits)
        .then($scope._setScope)
        .then(scopeUtils.success, $scope.error);
    };

    $scope._setScope = function (response) {
      // Set scope where possible regardless of error
      $scope.activities = response.activities;
      $scope.locations = response.locations;
      $scope.params = response.params;

      return response.errorMessage;
    };

    // Get initiatives
    $scope.getInitiatives = function () {
      var cfg,
          loadInits;

      // Promise to resolve request on navigation change
      INIT_TIMEOUT_PROMISE = $q.defer();

      // Promise/Explicit timeouts
      cfg = {
        timeoutPromise: INIT_TIMEOUT_PROMISE,
        timeout: 180000
      };

      loadInits = initiatives.get(cfg).then(function (data) {
        $scope.inits = data;
      });

      // Setup promise tracker for spinner on initial load
      INIT_TRACKER = promiseTracker('initTracker');
      INIT_TRACKER.addPromise(loadInits);

      return loadInits;
    };

    // Submit request and draw chart
    $scope.getData = function () {
      var cfg;

      // Promise to resolve request on navigation change
      DATA_TIMEOUT_PROMISE = $q.defer();
      $scope.state = uiStates.setUIState('loading');

      // Includes promise/explicit timeout values
      cfg = {
        params:         $scope.params,
        acts:           $scope.activities,
        locs:           $scope.locations,
        dataProcessor:  CONFIG.dataProcessor,
        timeoutPromise: DATA_TIMEOUT_PROMISE,
        timeout:        180000
      };

      return data[CONFIG.dataSource](cfg);
    };

    // Get initiative metadata
    $scope.getMetadata = function () {
      var actsLocsArys       = actsLocs.get($scope.params.init);
      $scope.activities      = actsLocsArys.activities;
      $scope.locations       = actsLocsArys.locations;
      $scope.params.location = $scope.locations[0];
    };

    // Update init metadata
    $scope.updateMetadata = function () {
      if ($scope.params.init) {
        $scope.processMetadata = true;
        $scope.getMetadata();

        // Artificially add a delay for UI
        $timeout(function () {
          $scope.processMetadata = false;
        }, 400);
      }
    };

    // Submit form and set URL
    $scope.submit = function () {
      var currentUrl,
          currentScope;

      currentUrl = $location.search();
      currentScope = scopeUtils.getCurrentScope($scope.params, $scope.activities);

      if (_.isEqual(currentUrl, currentScope)) {
        $scope.getData()
          .then($scope.success, $scope.error)
      } else {
        $location.search(currentScope);
      }
    };

    // Display error message
    $scope.error = function (data) {
      if (!data.promiseTimeout) {
        $scope.state        = uiStates.setUIState('error');
        $scope.errorMessage = data.message;
        $scope.errorCode    = data.code;
      }
    };

    // Assign data to scope and set state
    $scope.success = function (processedData) {
      $scope.state         = uiStates.setUIState('success');
      $scope.data          = processedData;
      $scope.summaryParams = angular.copy($scope.params);

      // Supplemental bar chart
      if (CONFIG.suppWatch) {
        $scope.$watch('data.actsLocsData', $scope.updateBarChart);
      }
    };

    $scope.updateBarChart = function () {
      var index = _.findIndex($scope.data.actsLocsData.items, function (item) {
        return item.title === $scope.data.barChartData.title;
      });

      $scope.data.barChartData = $scope.data.actsLocsData.items[index];
    };

    // Handle anchor links
    $scope.scrollTo = function (id) {
      var old = $location.hash();
      $location.hash(id);
      $anchorScroll();
      $location.hash(old);
    };

    // Attach listener for URL changes
    $scope.$on('$routeUpdate', $scope.initialize);

    // Initialize controller
    $scope.initialize();
  });
