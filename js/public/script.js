/**
 * ownCloud - contacts
 *
 * This file is licensed under the Affero General Public License version 3 or
 * later. See the COPYING file.
 *
 * @author Hendrik Leppelsack <hendrik@leppelsack.de>
 * @copyright Hendrik Leppelsack 2015
 */

angular.module('contactsApp', ['uuid4', 'angular-cache', 'ngRoute', 'ui.bootstrap', 'ui.select', 'ngSanitize'])
.config(['$routeProvider', function($routeProvider) {

	$routeProvider.when('/:gid', {
		template: '<contactdetails></contactdetails>'
	});

	$routeProvider.when('/:gid/:uid', {
		template: '<contactdetails></contactdetails>'
	});

	$routeProvider.otherwise('/' + t('contacts', 'All contacts'));

}]);

angular.module('contactsApp')
.directive('datepicker', function() {
	return {
		restrict: 'A',
		require : 'ngModel',
		link : function (scope, element, attrs, ngModelCtrl) {
			$(function() {
				element.datepicker({
					dateFormat:'yy-mm-dd',
					minDate: null,
					maxDate: null,
					onSelect:function (date) {
						ngModelCtrl.$setViewValue(date);
						scope.$apply();
					}
				});
			});
		}
	};
});

angular.module('contactsApp')
.directive('focusExpression', ['$timeout', function ($timeout) {
	return {
		restrict: 'A',
		link: {
			post: function postLink(scope, element, attrs) {
				scope.$watch(attrs.focusExpression, function () {
					if (attrs.focusExpression) {
						if (scope.$eval(attrs.focusExpression)) {
							$timeout(function () {
								if (element.is('input')) {
									element.focus();
								} else {
									element.find('input').focus();
								}
							}, 100); //need some delay to work with ng-disabled
						}
					}
				});
			}
		}
	};
}]);

angular.module('contactsApp')
.directive('inputresize', function() {
	return {
		restrict: 'A',
		link : function (scope, element) {
			var elInput = element.val();
			element.bind('keydown keyup load focus', function() {
				elInput = element.val();
				// If set to 0, the min-width css data is ignored
				var length = elInput.length > 1 ? elInput.length : 1;
				element.attr('size', length);
			});
		}
	};
});

angular.module('contactsApp')
.controller('addressbookCtrl', ['$scope', 'AddressBookService', function($scope, AddressBookService) {
	var ctrl = this;

	ctrl.showUrl = false;
	/* globals oc_config */
	/* eslint-disable camelcase */
	ctrl.canExport = oc_config.versionstring.split('.') >= [9, 0, 2];
	/* eslint-enable camelcase */

	ctrl.toggleShowUrl = function() {
		ctrl.showUrl = !ctrl.showUrl;
	};

	ctrl.toggleSharesEditor = function() {
		ctrl.editingShares = !ctrl.editingShares;
		ctrl.selectedSharee = null;
	};

	/* From Calendar-Rework - js/app/controllers/calendarlistcontroller.js */
	ctrl.findSharee = function (val) {
		return $.get(
			OC.linkToOCS('apps/files_sharing/api/v1') + 'sharees',
			{
				format: 'json',
				search: val.trim(),
				perPage: 200,
				itemType: 'principals'
			}
		).then(function(result) {
			// Todo - filter out current user, existing sharees
			var users   = result.ocs.data.exact.users.concat(result.ocs.data.users);
			var groups  = result.ocs.data.exact.groups.concat(result.ocs.data.groups);

			var userShares = ctrl.addressBook.sharedWith.users;
			var userSharesLength = userShares.length;
			var i, j;

			// Filter out current user
			var usersLength = users.length;
			for (i = 0 ; i < usersLength; i++) {
				if (users[i].value.shareWith === OC.currentUser) {
					users.splice(i, 1);
					break;
				}
			}

			// Now filter out all sharees that are already shared with
			for (i = 0; i < userSharesLength; i++) {
				var share = userShares[i];
				usersLength = users.length;
				for (j = 0; j < usersLength; j++) {
					if (users[j].value.shareWith === share.id) {
						users.splice(j, 1);
						break;
					}
				}
			}

			// Combine users and groups
			users = users.map(function(item) {
				return {
					display: item.value.shareWith,
					type: OC.Share.SHARE_TYPE_USER,
					identifier: item.value.shareWith
				};
			});

			groups = groups.map(function(item) {
				return {
					display: item.value.shareWith + ' (group)',
					type: OC.Share.SHARE_TYPE_GROUP,
					identifier: item.value.shareWith
				};
			});

			return groups.concat(users);
		});
	};

	ctrl.onSelectSharee = function (item) {
		ctrl.selectedSharee = null;
		AddressBookService.share(ctrl.addressBook, item.type, item.identifier, false, false).then(function() {
			$scope.$apply();
		});

	};

	ctrl.updateExistingUserShare = function(userId, writable) {
		AddressBookService.share(ctrl.addressBook, OC.Share.SHARE_TYPE_USER, userId, writable, true).then(function() {
			$scope.$apply();
		});
	};

	ctrl.updateExistingGroupShare = function(groupId, writable) {
		AddressBookService.share(ctrl.addressBook, OC.Share.SHARE_TYPE_GROUP, groupId, writable, true).then(function() {
			$scope.$apply();
		});
	};

	ctrl.unshareFromUser = function(userId) {
		AddressBookService.unshare(ctrl.addressBook, OC.Share.SHARE_TYPE_USER, userId).then(function() {
			$scope.$apply();
		});
	};

	ctrl.unshareFromGroup = function(groupId) {
		AddressBookService.unshare(ctrl.addressBook, OC.Share.SHARE_TYPE_GROUP, groupId).then(function() {
			$scope.$apply();
		});
	};

	ctrl.deleteAddressBook = function() {
		AddressBookService.delete(ctrl.addressBook).then(function() {
			$scope.$apply();
		});
	};

}]);

angular.module('contactsApp')
.directive('addressbook', function() {
	return {
		restrict: 'A', // has to be an attribute to work with core css
		scope: {},
		controller: 'addressbookCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			addressBook: '=data',
			list: '='
		},
		templateUrl: OC.linkTo('contacts', 'templates/addressBook.html')
	};
});

angular.module('contactsApp')
.controller('addressbooklistCtrl', ['$scope', 'AddressBookService', function($scope, AddressBookService) {
	var ctrl = this;

	ctrl.loading = true;

	AddressBookService.getAll().then(function(addressBooks) {
		ctrl.addressBooks = addressBooks;
		ctrl.loading = false;
	});

	ctrl.t = {
		addressBookName : t('contacts', 'Address book name')
	};

	ctrl.createAddressBook = function() {
		if(ctrl.newAddressBookName) {
			AddressBookService.create(ctrl.newAddressBookName).then(function() {
				AddressBookService.getAddressBook(ctrl.newAddressBookName).then(function(addressBook) {
					ctrl.addressBooks.push(addressBook);
					$scope.$apply();
				});
			});
		}
	};
}]);

angular.module('contactsApp')
.directive('addressbooklist', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'addressbooklistCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/addressBookList.html')
	};
});

angular.module('contactsApp')
.controller('avatarCtrl', ['ContactService', function(ContactService) {
	var ctrl = this;

	ctrl.import = ContactService.import.bind(ContactService);

}]);

angular.module('contactsApp')
.directive('avatar', ['ContactService', function(ContactService) {
	return {
		scope: {
			contact: '=data'
		},
		link: function(scope, element) {
			var importText = t('contacts', 'Import');
			scope.importText = importText;

			var input = element.find('input');
			input.bind('change', function() {
				var file = input.get(0).files[0];
				if (file.size > 1024*1024) { // 1 MB
					OC.Notification.showTemporary(t('contacts', 'The selected image is too big (max 1MB)'));
				} else {
					var reader = new FileReader();

					reader.addEventListener('load', function () {
						scope.$apply(function() {
							scope.contact.photo(reader.result);
							ContactService.update(scope.contact);
						});
					}, false);

					if (file) {
						reader.readAsDataURL(file);
					}
				}
			});
		},
		templateUrl: OC.linkTo('contacts', 'templates/avatar.html')
	};
}]);

angular.module('contactsApp')
.controller('contactCtrl', ['$route', '$routeParams', function($route, $routeParams) {
	var ctrl = this;

	ctrl.openContact = function() {
		$route.updateParams({
			gid: $routeParams.gid,
			uid: ctrl.contact.uid()});
	};
}]);

angular.module('contactsApp')
.directive('contact', function() {
	return {
		scope: {},
		controller: 'contactCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			contact: '=data'
		},
		templateUrl: OC.linkTo('contacts', 'templates/contact.html')
	};
});

angular.module('contactsApp')
.controller('contactdetailsCtrl', ['ContactService', 'AddressBookService', 'vCardPropertiesService', '$route', '$routeParams', '$scope', function(ContactService, AddressBookService, vCardPropertiesService, $route, $routeParams, $scope) {

	var ctrl = this;

	ctrl.loading = true;
	ctrl.show = false;

	ctrl.clearContact = function() {
		$route.updateParams({
			gid: $routeParams.gid,
			uid: undefined
		});
		ctrl.show = false;
		ctrl.contact = undefined;
	};

	ctrl.uid = $routeParams.uid;
	ctrl.t = {
		noContacts : t('contacts', 'No contacts in here'),
		placeholderName : t('contacts', 'Name'),
		placeholderOrg : t('contacts', 'Organization'),
		placeholderTitle : t('contacts', 'Title'),
		selectField : t('contacts', 'Add field ...')
	};

	ctrl.fieldDefinitions = vCardPropertiesService.fieldDefinitions;
	ctrl.focus = undefined;
	ctrl.field = undefined;
	ctrl.addressBooks = [];

	AddressBookService.getAll().then(function(addressBooks) {
		ctrl.addressBooks = addressBooks;

		if (!_.isUndefined(ctrl.contact)) {
			ctrl.addressBook = _.find(ctrl.addressBooks, function(book) {
				return book.displayName === ctrl.contact.addressBookId;
			});
		}
		ctrl.loading = false;
	});

	$scope.$watch('ctrl.uid', function(newValue) {
		ctrl.changeContact(newValue);
	});

	ctrl.changeContact = function(uid) {
		if (typeof uid === 'undefined') {
			ctrl.show = false;
			$('#app-navigation-toggle').removeClass('showdetails');
			return;
		}
		ContactService.getById(uid).then(function(contact) {
			if (angular.isUndefined(contact)) {
				ctrl.clearContact();
				return;
			}
			ctrl.contact = contact;
			ctrl.show = true;
			$('#app-navigation-toggle').addClass('showdetails');

			ctrl.addressBook = _.find(ctrl.addressBooks, function(book) {
				return book.displayName === ctrl.contact.addressBookId;
			});
		});
	};

	ctrl.updateContact = function() {
		ContactService.update(ctrl.contact);
	};

	ctrl.deleteContact = function() {
		ContactService.delete(ctrl.contact);
	};

	ctrl.addField = function(field) {
		var defaultValue = vCardPropertiesService.getMeta(field).defaultValue || {value: ''};
		ctrl.contact.addProperty(field, defaultValue);
		ctrl.focus = field;
		ctrl.field = '';
	};

	ctrl.deleteField = function (field, prop) {
		ctrl.contact.removeProperty(field, prop);
		ctrl.focus = undefined;
	};

	ctrl.changeAddressBook = function (addressBook) {
		ContactService.moveContact(ctrl.contact, addressBook);
	};
}]);

angular.module('contactsApp')
.directive('contactdetails', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'contactdetailsCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/contactDetails.html')
	};
});

angular.module('contactsApp')
.controller('contactimportCtrl', ['ContactService', function(ContactService) {
	var ctrl = this;

	ctrl.import = ContactService.import.bind(ContactService);

}]);

angular.module('contactsApp')
.directive('contactimport', ['ContactService', function(ContactService) {
	return {
		link: function(scope, element) {
			var importText = t('contacts', 'Import');
			scope.importText = importText;

			var input = element.find('input');
			input.bind('change', function() {
				var file = input.get(0).files[0];
				var reader = new FileReader();

				reader.addEventListener('load', function () {
					scope.$apply(function() {
						ContactService.import.call(ContactService, reader.result, file.type, null, function(progress) {
							if(progress===1) {
								scope.importText = importText;
							} else {
								scope.importText = parseInt(Math.floor(progress*100))+'%';
							}
						});
					});
				}, false);

				if (file) {
					reader.readAsText(file);
				}
			});
		},
		templateUrl: OC.linkTo('contacts', 'templates/contactImport.html')
	};
}]);

angular.module('contactsApp')
.controller('contactlistCtrl', ['$scope', '$filter', '$route', '$routeParams', 'ContactService', 'vCardPropertiesService', 'SearchService', function($scope, $filter, $route, $routeParams, ContactService, vCardPropertiesService, SearchService) {
	var ctrl = this;

	ctrl.routeParams = $routeParams;

	ctrl.contactList = [];
	ctrl.searchTerm = '';
	ctrl.show = true;
	ctrl.invalid = false;

	ctrl.t = {
		addContact : t('contacts', 'Add contact'),
		emptySearch : t('contacts', 'No search result for {query}', {query: ctrl.searchTerm})
	};


	$scope.query = function(contact) {
		return contact.matches(SearchService.getSearchTerm());
	};

	SearchService.registerObserverCallback(function(ev) {
		if (ev.event === 'submitSearch') {
			var uid = !_.isEmpty(ctrl.contactList) ? ctrl.contactList[0].uid() : undefined;
			ctrl.setSelectedId(uid);
			$scope.$apply();
		}
		if (ev.event === 'changeSearch') {
			ctrl.searchTerm = ev.searchTerm;
			ctrl.t.emptySearch = t('contacts',
								   'No search result for {query}',
								   {query: ctrl.searchTerm}
								  );
			$scope.$apply();
		}
	});

	ctrl.loading = true;

	ContactService.registerObserverCallback(function(ev) {
		$scope.$apply(function() {
			if (ev.event === 'delete') {
				if (ctrl.contactList.length === 1) {
					$route.updateParams({
						gid: $routeParams.gid,
						uid: undefined
					});
				} else {
					for (var i = 0, length = ctrl.contactList.length; i < length; i++) {
						if (ctrl.contactList[i].uid() === ev.uid) {
							$route.updateParams({
								gid: $routeParams.gid,
								uid: (ctrl.contactList[i+1]) ? ctrl.contactList[i+1].uid() : ctrl.contactList[i-1].uid()
							});
							break;
						}
					}
				}
			}
			else if (ev.event === 'create') {
				$route.updateParams({
					gid: $routeParams.gid,
					uid: ev.uid
				});
			}
			ctrl.contacts = ev.contacts;
		});
	});

	// Get contacts
	ContactService.getAll().then(function(contacts) {
		if(contacts.length>0) {
			$scope.$apply(function() {
				ctrl.contacts = contacts;
			});
		} else {
			ctrl.loading = false;
		}
	});

	// Wait for ctrl.contactList to be updated, load the first contact and kill the watch
	var unbindListWatch = $scope.$watch('ctrl.contactList', function() {
		if(ctrl.contactList && ctrl.contactList.length > 0) {
			// Check if a specific uid is requested
			if($routeParams.uid && $routeParams.gid) {
				ctrl.contactList.forEach(function(contact) {
					if(contact.uid() === $routeParams.uid) {
						ctrl.setSelectedId($routeParams.uid);
						ctrl.loading = false;
					}
				});
			}
			// No contact previously loaded, let's load the first of the list if not in mobile mode
			if(ctrl.loading && $(window).width() > 768) {
				ctrl.setSelectedId(ctrl.contactList[0].uid());
			}
			ctrl.loading = false;
			unbindListWatch();
		}
	});

	$scope.$watch('ctrl.routeParams.uid', function(newValue, oldValue) {
		// Used for mobile view to clear the url
		if(typeof oldValue != 'undefined' && typeof newValue == 'undefined' && $(window).width() <= 768) {
			// no contact selected
			ctrl.show = true;
			return;
		}
		if(newValue === undefined) {
			// we might have to wait until ng-repeat filled the contactList
			if(ctrl.contactList && ctrl.contactList.length > 0) {
				$route.updateParams({
					gid: $routeParams.gid,
					uid: ctrl.contactList[0].uid()
				});
			} else {
				// watch for next contactList update
				var unbindWatch = $scope.$watch('ctrl.contactList', function() {
					if(ctrl.contactList && ctrl.contactList.length > 0) {
						$route.updateParams({
							gid: $routeParams.gid,
							uid: ctrl.contactList[0].uid()
						});
					}
					unbindWatch(); // unbind as we only want one update
				});
			}
		} else {
			// displaying contact details
			ctrl.show = false;
		}
	});

	$scope.$watch('ctrl.routeParams.gid', function() {
		// we might have to wait until ng-repeat filled the contactList
		ctrl.contactList = [];
		// not in mobile mode
		if($(window).width() > 768) {
			// watch for next contactList update
			var unbindWatch = $scope.$watch('ctrl.contactList', function() {
				if(ctrl.contactList && ctrl.contactList.length > 0) {
					$route.updateParams({
						gid: $routeParams.gid,
						uid: ctrl.contactList[0].uid()
					});
				}
				unbindWatch(); // unbind as we only want one update
			});
		}
	});

	// Watch if we have an invalid contact
	$scope.$watch('ctrl.contactList[0].displayName()', function(displayName) {
		ctrl.invalid = (displayName === '');
	});

	ctrl.createContact = function() {
		ContactService.create().then(function(contact) {
			['tel', 'adr', 'email'].forEach(function(field) {
				var defaultValue = vCardPropertiesService.getMeta(field).defaultValue || {value: ''};
				contact.addProperty(field, defaultValue);
			} );
			if ([t('contacts', 'All contacts'), t('contacts', 'Not grouped')].indexOf($routeParams.gid) === -1) {
				contact.categories($routeParams.gid);
			} else {
				contact.categories('');
			}
			$('#details-fullName').focus();
		});
	};

	ctrl.hasContacts = function () {
		if (!ctrl.contacts) {
			return false;
		}
		return ctrl.contacts.length > 0;
	};

	ctrl.setSelectedId = function (contactId) {
		$route.updateParams({
			uid: contactId
		});
	};

	ctrl.getSelectedId = function() {
		return $routeParams.uid;
	};

}]);

angular.module('contactsApp')
.directive('contactlist', function() {
	return {
		priority: 1,
		scope: {},
		controller: 'contactlistCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			addressbook: '=adrbook'
		},
		templateUrl: OC.linkTo('contacts', 'templates/contactList.html')
	};
});

angular.module('contactsApp')
.controller('detailsItemCtrl', ['$templateRequest', 'vCardPropertiesService', 'ContactService', function($templateRequest, vCardPropertiesService, ContactService) {
	var ctrl = this;

	ctrl.meta = vCardPropertiesService.getMeta(ctrl.name);
	ctrl.type = undefined;
	ctrl.isPreferred = false;
	ctrl.t = {
		poBox : t('contacts', 'Post office box'),
		postalCode : t('contacts', 'Postal code'),
		city : t('contacts', 'City'),
		state : t('contacts', 'State or province'),
		country : t('contacts', 'Country'),
		address: t('contacts', 'Address'),
		newGroup: t('contacts', '(new group)'),
		familyName: t('contacts', 'Last name'),
		firstName: t('contacts', 'First name'),
		additionalNames: t('contacts', 'Additional names'),
		honorificPrefix: t('contacts', 'Prefix'),
		honorificSuffix: t('contacts', 'Suffix')
	};

	ctrl.availableOptions = ctrl.meta.options || [];
	if (!_.isUndefined(ctrl.data) && !_.isUndefined(ctrl.data.meta) && !_.isUndefined(ctrl.data.meta.type)) {
		// parse type of the property
		var array = ctrl.data.meta.type[0].split(',');
		array = array.map(function (elem) {
			return elem.trim().replace(/\/+$/, '').replace(/\\+$/, '').trim().toUpperCase();
		});
		// the pref value is handled on its own so that we can add some favorite icon to the ui if we want
		if (array.indexOf('PREF') >= 0) {
			ctrl.isPreferred = true;
			array.splice(array.indexOf('PREF'), 1);
		}
		// simply join the upper cased types together as key
		ctrl.type = array.join(',');
		var displayName = array.map(function (element) {
			return element.charAt(0).toUpperCase() + element.slice(1).toLowerCase();
		}).join(' ');

		// in case the type is not yet in the default list of available options we add it
		if (!ctrl.availableOptions.some(function(e) { return e.id === ctrl.type; } )) {
			ctrl.availableOptions = ctrl.availableOptions.concat([{id: ctrl.type, name: displayName}]);
		}
	}
	ctrl.availableGroups = [];

	ContactService.getGroups().then(function(groups) {
		ctrl.availableGroups = _.unique(groups);
	});

	ctrl.changeType = function (val) {
		if (ctrl.isPreferred) {
			val += ',PREF';
		}
		ctrl.data.meta = ctrl.data.meta || {};
		ctrl.data.meta.type = ctrl.data.meta.type || [];
		ctrl.data.meta.type[0] = val;
		ctrl.model.updateContact();
	};

	ctrl.updateDetailedName = function () {
		var fn = '';
		if (ctrl.data.value[3]) {
			fn += ctrl.data.value[3] + ' ';
		}
		if (ctrl.data.value[1]) {
			fn += ctrl.data.value[1] + ' ';
		}
		if (ctrl.data.value[2]) {
			fn += ctrl.data.value[2] + ' ';
		}
		if (ctrl.data.value[0]) {
			fn += ctrl.data.value[0] + ' ';
		}
		if (ctrl.data.value[4]) {
			fn += ctrl.data.value[4];
		}

		ctrl.model.contact.fullName(fn);
		ctrl.model.updateContact();
	};

	ctrl.getTemplate = function() {
		var templateUrl = OC.linkTo('contacts', 'templates/detailItems/' + ctrl.meta.template + '.html');
		return $templateRequest(templateUrl);
	};

	ctrl.deleteField = function () {
		ctrl.model.deleteField(ctrl.name, ctrl.data);
		ctrl.model.updateContact();
	};
}]);

angular.module('contactsApp')
.directive('detailsitem', ['$compile', function($compile) {
	return {
		scope: {},
		controller: 'detailsItemCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			name: '=',
			data: '=',
			model: '='
		},
		link: function(scope, element, attrs, ctrl) {
			ctrl.getTemplate().then(function(html) {
				var template = angular.element(html);
				element.append(template);
				$compile(template)(scope);
			});
		}
	};
}]);

angular.module('contactsApp')
.controller('groupCtrl', function() {
	// eslint-disable-next-line no-unused-vars
	var ctrl = this;
});

angular.module('contactsApp')
.directive('group', function() {
	return {
		restrict: 'A', // has to be an attribute to work with core css
		scope: {},
		controller: 'groupCtrl',
		controllerAs: 'ctrl',
		bindToController: {
			group: '=data'
		},
		templateUrl: OC.linkTo('contacts', 'templates/group.html')
	};
});

angular.module('contactsApp')
.controller('grouplistCtrl', ['$scope', 'ContactService', 'SearchService', '$routeParams', function($scope, ContactService, SearchService, $routeParams) {
	var ctrl = this;

	var initialGroups = [t('contacts', 'All contacts'), t('contacts', 'Not grouped')];

	ctrl.groups = initialGroups;

	ContactService.getGroups().then(function(groups) {
		ctrl.groups = _.unique(initialGroups.concat(groups));
	});

	ctrl.getSelected = function() {
		return $routeParams.gid;
	};

	// Update groupList on contact add/delete/update
	ContactService.registerObserverCallback(function() {
		$scope.$apply(function() {
			ContactService.getGroups().then(function(groups) {
				ctrl.groups = _.unique(initialGroups.concat(groups));
			});
		});
	});

	ctrl.setSelected = function (selectedGroup) {
		SearchService.cleanSearch();
		$routeParams.gid = selectedGroup;
	};
}]);

angular.module('contactsApp')
.directive('grouplist', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'grouplistCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/groupList.html')
	};
});

angular.module('contactsApp')
.directive('groupModel', function() {
	return{
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attr, ngModel) {
			ngModel.$formatters.push(function(value) {
				if (value.trim().length === 0) {
					return [];
				}
				return value.split(',');
			});
			ngModel.$parsers.push(function(value) {
				return value.join(',');
			});
		}
	};
});

angular.module('contactsApp')
.directive('telModel', function() {
	return{
		restrict: 'A',
		require: 'ngModel',
		link: function(scope, element, attr, ngModel) {
			ngModel.$formatters.push(function(value) {
				return value;
			});
			ngModel.$parsers.push(function(value) {
				return value;
			});
		}
	};
});

angular.module('contactsApp')
.factory('AddressBook', function()
{
	return function AddressBook(data) {
		angular.extend(this, {

			displayName: '',
			contacts: [],
			groups: data.data.props.groups,

			getContact: function(uid) {
				for(var i in this.contacts) {
					if(this.contacts[i].uid() === uid) {
						return this.contacts[i];
					}
				}
				return undefined;
			},

			sharedWith: {
				users: [],
				groups: []
			}

		});
		angular.extend(this, data);
		angular.extend(this, {
			owner: data.url.split('/').slice(-3, -2)[0]
		});

		var shares = this.data.props.invite;
		if (typeof shares !== 'undefined') {
			for (var j = 0; j < shares.length; j++) {
				var href = shares[j].href;
				if (href.length === 0) {
					continue;
				}
				var access = shares[j].access;
				if (access.length === 0) {
					continue;
				}

				var readWrite = (typeof access.readWrite !== 'undefined');

				if (href.startsWith('principal:principals/users/')) {
					this.sharedWith.users.push({
						id: href.substr(27),
						displayname: href.substr(27),
						writable: readWrite
					});
				} else if (href.startsWith('principal:principals/groups/')) {
					this.sharedWith.groups.push({
						id: href.substr(28),
						displayname: href.substr(28),
						writable: readWrite
					});
				}
			}
		}

		//var owner = this.data.props.owner;
		//if (typeof owner !== 'undefined' && owner.length !== 0) {
		//	owner = owner.trim();
		//	if (owner.startsWith('/remote.php/dav/principals/users/')) {
		//		this._properties.owner = owner.substr(33);
		//	}
		//}

	};
});

angular.module('contactsApp')
.factory('Contact', ['$filter', function($filter) {
	return function Contact(addressBook, vCard) {
		angular.extend(this, {

			data: {},
			props: {},

			addressBookId: addressBook.displayName,

			uid: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return model.setProperty('uid', { value: value });
				} else {
					// getter
					return model.getProperty('uid').value;
				}
			},

			displayName: function() {
				return this.fullName() || this.org() || '';
			},

			fullName: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('fn', { value: value });
				} else {
					// getter
					var property = model.getProperty('fn');
					if(property) {
						return property.value;
					}
					property = model.getProperty('n');
					if(property) {
						return property.value.join();
					}
					return undefined;
				}
			},

			title: function(value) {
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('title', { value: value });
				} else {
					// getter
					var property = this.getProperty('title');
					if(property) {
						return property.value;
					} else {
						return undefined;
					}
				}
			},

			org: function(value) {
				var property = this.getProperty('org');
				if (angular.isDefined(value)) {
					var val = value;
					// setter
					if(property && Array.isArray(property.value)) {
						val = property.value;
						val[0] = value;
					}
					return this.setProperty('org', { value: val });
				} else {
					// getter
					if(property) {
						if (Array.isArray(property.value)) {
							return property.value[0];
						}
						return property.value;
					} else {
						return undefined;
					}
				}
			},

			email: function() {
				// getter
				var property = this.getProperty('email');
				if(property) {
					return property.value;
				} else {
					return undefined;
				}
			},

			photo: function(value) {
				if (angular.isDefined(value)) {
					// setter
					// splits image data into "data:image/jpeg" and base 64 encoded image
					var imageData = value.split(';base64,');
					var imageType = imageData[0].slice('data:'.length);

					return this.setProperty('photo', { value: imageData[1], meta: {type: [imageType]} });
				} else {
					var property = this.getProperty('photo');
					if(property) {
						var type = property.meta.type;
						if (angular.isArray(type)) {
							type = type[0];
						}
						if (!type.startsWith('image/')) {
							type = 'image/' + type.toLowerCase();
						}
						return 'data:' + type + ';base64,' + property.value;
					} else {
						return undefined;
					}
				}
			},

			categories: function(value) {
				if (angular.isDefined(value)) {
					// setter
					return this.setProperty('categories', { value: value });
				} else {
					// getter
					var property = this.getProperty('categories');
					if(property && property.value.length > 0) {
						return property.value.split(',');
					} else {
						return [];
					}
				}
			},

			getProperty: function(name) {
				if (this.props[name]) {
					return this.props[name][0];
				} else {
					return undefined;
				}
			},
			addProperty: function(name, data) {
				data = angular.copy(data);
				if(!this.props[name]) {
					this.props[name] = [];
				}
				var idx = this.props[name].length;
				this.props[name][idx] = data;

				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
				return idx;
			},
			setProperty: function(name, data) {
				if(!this.props[name]) {
					this.props[name] = [];
				}
				this.props[name][0] = data;

				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},
			removeProperty: function (name, prop) {
				angular.copy(_.without(this.props[name], prop), this.props[name]);
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},
			setETag: function(etag) {
				this.data.etag = etag;
			},
			setUrl: function(addressBook, uid) {
				this.data.url = addressBook.url + uid + '.vcf';
			},

			syncVCard: function() {
				// keep vCard in sync
				this.data.addressData = $filter('JSON2vCard')(this.props);
			},

			matches: function(pattern) {
				if (_.isUndefined(pattern) || pattern.length === 0) {
					return true;
				}
				var model = this;
				var matchingProps = ['fn', 'title', 'org', 'email', 'nickname', 'note', 'url', 'cloud', 'adr', 'impp', 'tel'].filter(function (propName) {
					if (model.props[propName]) {
						return model.props[propName].filter(function (property) {
							if (!property.value) {
								return false;
							}
							if (_.isString(property.value)) {
								return property.value.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
							}
							if (_.isArray(property.value)) {
								return property.value.filter(function(v) {
									return v.toLowerCase().indexOf(pattern.toLowerCase()) !== -1;
								}).length > 0;
							}
							return false;
						}).length > 0;
					}
					return false;
				});
				return matchingProps.length > 0;
			}

		});

		if(angular.isDefined(vCard)) {
			angular.extend(this.data, vCard);
			angular.extend(this.props, $filter('vCard2JSON')(this.data.addressData));
		} else {
			angular.extend(this.props, {
				version: [{value: '3.0'}],
				fn: [{value: ''}]
			});
			this.data.addressData = $filter('JSON2vCard')(this.props);
		}

		var property = this.getProperty('categories');
		if(!property) {
			this.categories('');
		}
	};
}]);

angular.module('contactsApp')
.factory('AddressBookService', ['DavClient', 'DavService', 'SettingsService', 'AddressBook', '$q', function(DavClient, DavService, SettingsService, AddressBook, $q) {

	var addressBooks = [];
	var loadPromise = undefined;

	var loadAll = function() {
		if (addressBooks.length > 0) {
			return $q.when(addressBooks);
		}
		if (_.isUndefined(loadPromise)) {
			loadPromise = DavService.then(function(account) {
				loadPromise = undefined;
				addressBooks = account.addressBooks.map(function(addressBook) {
					return new AddressBook(addressBook);
				});
			});
		}
		return loadPromise;
	};

	return {
		getAll: function() {
			return loadAll().then(function() {
				return addressBooks;
			});
		},

		getGroups: function () {
			return this.getAll().then(function(addressBooks) {
				return addressBooks.map(function (element) {
					return element.groups;
				}).reduce(function(a, b) {
					return a.concat(b);
				});
			});
		},

		getDefaultAddressBook: function() {
			return addressBooks[0];
		},

		getAddressBook: function(displayName) {
			return DavService.then(function(account) {
				return DavClient.getAddressBook({displayName:displayName, url:account.homeUrl}).then(function(addressBook) {
					addressBook = new AddressBook({
						url: addressBook[0].href,
						data: addressBook[0]
					});
					addressBook.displayName = displayName;
					return addressBook;
				});
			});
		},

		create: function(displayName) {
			return DavService.then(function(account) {
				return DavClient.createAddressBook({displayName:displayName, url:account.homeUrl});
			});
		},

		delete: function(addressBook) {
			return DavService.then(function() {
				return DavClient.deleteAddressBook(addressBook).then(function() {
					var index = addressBooks.indexOf(addressBook);
					addressBooks.splice(index, 1);
				});
			});
		},

		rename: function(addressBook, displayName) {
			return DavService.then(function(account) {
				return DavClient.renameAddressBook(addressBook, {displayName:displayName, url:account.homeUrl});
			});
		},

		get: function(displayName) {
			return this.getAll().then(function(addressBooks) {
				return addressBooks.filter(function (element) {
					return element.displayName === displayName;
				})[0];
			});
		},

		sync: function(addressBook) {
			return DavClient.syncAddressBook(addressBook);
		},

		share: function(addressBook, shareType, shareWith, writable, existingShare) {
			var xmlDoc = document.implementation.createDocument('', '', null);
			var oShare = xmlDoc.createElement('o:share');
			oShare.setAttribute('xmlns:d', 'DAV:');
			oShare.setAttribute('xmlns:o', 'http://owncloud.org/ns');
			xmlDoc.appendChild(oShare);

			var oSet = xmlDoc.createElement('o:set');
			oShare.appendChild(oSet);

			var dHref = xmlDoc.createElement('d:href');
			if (shareType === OC.Share.SHARE_TYPE_USER) {
				dHref.textContent = 'principal:principals/users/';
			} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
				dHref.textContent = 'principal:principals/groups/';
			}
			dHref.textContent += shareWith;
			oSet.appendChild(dHref);

			var oSummary = xmlDoc.createElement('o:summary');
			oSummary.textContent = t('contacts', '{addressbook} shared by {owner}', {
				addressbook: addressBook.displayName,
				owner: addressBook.owner
			});
			oSet.appendChild(oSummary);

			if (writable) {
				var oRW = xmlDoc.createElement('o:read-write');
				oSet.appendChild(oRW);
			}

			var body = oShare.outerHTML;

			return DavClient.xhr.send(
				dav.request.basic({method: 'POST', data: body}),
				addressBook.url
			).then(function(response) {
				if (response.status === 200) {
					if (!existingShare) {
						if (shareType === OC.Share.SHARE_TYPE_USER) {
							addressBook.sharedWith.users.push({
								id: shareWith,
								displayname: shareWith,
								writable: writable
							});
						} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
							addressBook.sharedWith.groups.push({
								id: shareWith,
								displayname: shareWith,
								writable: writable
							});
						}
					}
				}
			});

		},

		unshare: function(addressBook, shareType, shareWith) {
			var xmlDoc = document.implementation.createDocument('', '', null);
			var oShare = xmlDoc.createElement('o:share');
			oShare.setAttribute('xmlns:d', 'DAV:');
			oShare.setAttribute('xmlns:o', 'http://owncloud.org/ns');
			xmlDoc.appendChild(oShare);

			var oRemove = xmlDoc.createElement('o:remove');
			oShare.appendChild(oRemove);

			var dHref = xmlDoc.createElement('d:href');
			if (shareType === OC.Share.SHARE_TYPE_USER) {
				dHref.textContent = 'principal:principals/users/';
			} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
				dHref.textContent = 'principal:principals/groups/';
			}
			dHref.textContent += shareWith;
			oRemove.appendChild(dHref);
			var body = oShare.outerHTML;


			return DavClient.xhr.send(
				dav.request.basic({method: 'POST', data: body}),
				addressBook.url
			).then(function(response) {
				if (response.status === 200) {
					if (shareType === OC.Share.SHARE_TYPE_USER) {
						addressBook.sharedWith.users = addressBook.sharedWith.users.filter(function(user) {
							return user.id !== shareWith;
						});
					} else if (shareType === OC.Share.SHARE_TYPE_GROUP) {
						addressBook.sharedWith.groups = addressBook.sharedWith.groups.filter(function(groups) {
							return groups.id !== shareWith;
						});
					}
					//todo - remove entry from addressbook object
					return true;
				} else {
					return false;
				}
			});

		}


	};

}]);

angular.module('contactsApp')
.service('ContactService', ['DavClient', 'AddressBookService', 'Contact', '$q', 'CacheFactory', 'uuid4', function(DavClient, AddressBookService, Contact, $q, CacheFactory, uuid4) {

	var cacheFilled = false;

	var contacts = CacheFactory('contacts');

	var observerCallbacks = [];

	var loadPromise = undefined;

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function(eventName, uid) {
		var ev = {
			event: eventName,
			uid: uid,
			contacts: contacts.values()
		};
		angular.forEach(observerCallbacks, function(callback) {
			callback(ev);
		});
	};

	this.fillCache = function() {
		if (_.isUndefined(loadPromise)) {
			loadPromise = AddressBookService.getAll().then(function (enabledAddressBooks) {
				var promises = [];
				enabledAddressBooks.forEach(function (addressBook) {
					promises.push(
						AddressBookService.sync(addressBook).then(function (addressBook) {
							for (var i in addressBook.objects) {
								if (addressBook.objects[i].addressData) {
									var contact = new Contact(addressBook, addressBook.objects[i]);
									contacts.put(contact.uid(), contact);
								} else {
									// custom console
									console.log('Invalid contact received: ' + addressBook.objects[i].url);
								}
							}
						})
					);
				});
				return $q.all(promises).then(function () {
					cacheFilled = true;
				});
			});
		}
		return loadPromise;
	};

	this.getAll = function() {
		if(cacheFilled === false) {
			return this.fillCache().then(function() {
				return contacts.values();
			});
		} else {
			return $q.when(contacts.values());
		}
	};

	this.getGroups = function () {
		return this.getAll().then(function(contacts) {
			return _.uniq(contacts.map(function (element) {
				return element.categories();
			}).reduce(function(a, b) {
				return a.concat(b);
			}, []).sort(), true);
		});
	};

	this.getById = function(uid) {
		if(cacheFilled === false) {
			return this.fillCache().then(function() {
				return contacts.get(uid);
			});
		} else {
			return $q.when(contacts.get(uid));
		}
	};

	this.create = function(newContact, addressBook, uid) {
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();
		newContact = newContact || new Contact(addressBook);
		var newUid = '';
		if(uuid4.validate(uid)) {
			newUid = uid;
		} else {
			newUid = uuid4.generate();
		}
		newContact.uid(newUid);
		newContact.setUrl(addressBook, newUid);
		newContact.addressBookId = addressBook.displayName;

		return DavClient.createCard(
			addressBook,
			{
				data: newContact.data.addressData,
				filename: newUid + '.vcf'
			}
		).then(function(xhr) {
			newContact.setETag(xhr.getResponseHeader('ETag'));
			contacts.put(newUid, newContact);
			notifyObservers('create', newUid);
			return newContact;
		}).catch(function(e) {
			console.log("Couldn't create", e);
		});
	};

	this.import = function(data, type, addressBook, progressCallback) {
		addressBook = addressBook || AddressBookService.getDefaultAddressBook();

		var regexp = /BEGIN:VCARD[\s\S]*?END:VCARD/mgi;
		var singleVCards = data.match(regexp);

		if (!singleVCards) {
			OC.Notification.showTemporary(t('contacts', 'No contacts in file. Only VCard files are allowed.'));
			if (progressCallback) {
				progressCallback(1);
			}
			return;
		}
		var num = 1;
		for(var i in singleVCards) {
			var newContact = new Contact(addressBook, {addressData: singleVCards[i]});
			this.create(newContact, addressBook).then(function() {
				// Update the progress indicator
				if (progressCallback) progressCallback(num/singleVCards.length);
				num++;
			});
		}
	};

	this.moveContact = function (contact, addressbook) {
		if (contact.addressBookId === addressbook.displayName) {
			return;
		}
		contact.syncVCard();
		var clone = angular.copy(contact);
		var uid = contact.uid();

		// delete the old one before to avoid conflict
		this.delete(contact);

		// create the contact in the new target addressbook
		this.create(clone, addressbook, uid);
	};

	this.update = function(contact) {
		contact.syncVCard();

		// update contact on server
		return DavClient.updateCard(contact.data, {json: true}).then(function(xhr) {
			var newEtag = xhr.getResponseHeader('ETag');
			contact.setETag(newEtag);
			notifyObservers('update', contact.uid());
		});
	};

	this.delete = function(contact) {
		// delete contact from server
		return DavClient.deleteCard(contact.data).then(function() {
			contacts.remove(contact.uid());
			notifyObservers('delete', contact.uid());
		});
	};
}]);

angular.module('contactsApp')
.service('DavClient', function() {
	var xhr = new dav.transport.Basic(
		new dav.Credentials()
	);
	return new dav.Client(xhr);
});

angular.module('contactsApp')
.service('DavService', ['DavClient', function(DavClient) {
	return DavClient.createAccount({
		server: OC.linkToRemote('dav/addressbooks'),
		accountType: 'carddav',
		useProvidedPath: true
	});
}]);

angular.module('contactsApp')
.service('SearchService', function() {
	var searchTerm = '';

	var observerCallbacks = [];

	this.registerObserverCallback = function(callback) {
		observerCallbacks.push(callback);
	};

	var notifyObservers = function(eventName) {
		var ev = {
			event:eventName,
			searchTerm:searchTerm
		};
		angular.forEach(observerCallbacks, function(callback) {
			callback(ev);
		});
	};

	var SearchProxy = {
		attach: function(search) {
			search.setFilter('contacts', this.filterProxy);
		},
		filterProxy: function(query) {
			searchTerm = query;
			notifyObservers('changeSearch');
		}
	};

	this.getSearchTerm = function() {
		return searchTerm;
	};

	this.cleanSearch = function() {
		if (!_.isUndefined($('.searchbox'))) {
			$('.searchbox')[0].reset();
		}
		searchTerm = '';
	};

	if (!_.isUndefined(OC.Plugins)) {
		OC.Plugins.register('OCA.Search', SearchProxy);
		if (!_.isUndefined(OCA.Search)) {
			OC.Search = new OCA.Search($('#searchbox'), $('#searchresults'));
			$('#searchbox').show();
		}
	}

	if (!_.isUndefined($('.searchbox'))) {
		$('.searchbox')[0].addEventListener('keypress', function(e) {
			if(e.keyCode === 13) {
				notifyObservers('submitSearch');
			}
		});
	}
});

angular.module('contactsApp')
.service('SettingsService', function() {
	var settings = {
		addressBooks: [
			'testAddr'
		]
	};

	this.set = function(key, value) {
		settings[key] = value;
	};

	this.get = function(key) {
		return settings[key];
	};

	this.getAll = function() {
		return settings;
	};
});

angular.module('contactsApp')
.service('vCardPropertiesService', function() {
	/**
	 * map vCard attributes to internal attributes
	 *
	 * propName: {
	 * 		multiple: [Boolean], // is this prop allowed more than once? (default = false)
	 * 		readableName: [String], // internationalized readable name of prop
	 * 		template: [String], // template name found in /templates/detailItems
	 * 		[...] // optional additional information which might get used by the template
	 * }
	 */
	this.vCardMeta = {
		nickname: {
			readableName: t('contacts', 'Nickname'),
			template: 'text'
		},
		n: {
			readableName: t('contacts', 'Detailed name'),
			defaultValue: {
				value:['', '', '', '', '']
			},
			template: 'n'
		},
		note: {
			readableName: t('contacts', 'Notes'),
			template: 'textarea'
		},
		url: {
			multiple: true,
			readableName: t('contacts', 'Website'),
			template: 'url'
		},
		cloud: {
			multiple: true,
			readableName: t('contacts', 'Federated Cloud ID'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]		},
		adr: {
			multiple: true,
			readableName: t('contacts', 'Address'),
			template: 'adr',
			defaultValue: {
				value:['', '', '', '', '', '', ''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		categories: {
			readableName: t('contacts', 'Groups'),
			template: 'groups'
		},
		bday: {
			readableName: t('contacts', 'Birthday'),
			template: 'date'
		},
		email: {
			multiple: true,
			readableName: t('contacts', 'Email'),
			template: 'text',
			defaultValue: {
				value:'',
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		impp: {
			multiple: true,
			readableName: t('contacts', 'Instant messaging'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['HOME']}
			},
			options: [
				{id: 'HOME', name: t('contacts', 'Home')},
				{id: 'WORK', name: t('contacts', 'Work')},
				{id: 'OTHER', name: t('contacts', 'Other')}
			]
		},
		tel: {
			multiple: true,
			readableName: t('contacts', 'Phone'),
			template: 'tel',
			defaultValue: {
				value:[''],
				meta:{type:['HOME,VOICE']}
			},
			options: [
				{id: 'HOME,VOICE', name: t('contacts', 'Home')},
				{id: 'WORK,VOICE', name: t('contacts', 'Work')},
				{id: 'CELL', name: t('contacts', 'Mobile')},
				{id: 'FAX', name: t('contacts', 'Fax')},
				{id: 'HOME,FAX', name: t('contacts', 'Fax home')},
				{id: 'WORK,FAX', name: t('contacts', 'Fax work')},
				{id: 'PAGER', name: t('contacts', 'Pager')},
				{id: 'VOICE', name: t('contacts', 'Voice')}
			]
		},
		'X-SOCIALPROFILE': {
			multiple: true,
			readableName: t('contacts', 'Social network'),
			template: 'text',
			defaultValue: {
				value:[''],
				meta:{type:['facebook']}
			},
			options: [
				{id: 'FACEBOOK', name: 'Facebook'},
				{id: 'TWITTER', name: 'Twitter'}
			]

		}
	};

	this.fieldOrder = [
		'org',
		'title',
		'tel',
		'email',
		'adr',
		'impp',
		'nick',
		'bday',
		'url',
		'X-SOCIALPROFILE',
		'note',
		'categories',
		'role'
	];

	this.fieldDefinitions = [];
	for (var prop in this.vCardMeta) {
		this.fieldDefinitions.push({id: prop, name: this.vCardMeta[prop].readableName, multiple: !!this.vCardMeta[prop].multiple});
	}

	this.fallbackMeta = function(property) {
		function capitalize(string) { return string.charAt(0).toUpperCase() + string.slice(1); }
		return {
			name: 'unknown-' + property,
			readableName: capitalize(property),
			template: 'hidden',
			necessity: 'optional'
		};
	};

	this.getMeta = function(property) {
		return this.vCardMeta[property] || this.fallbackMeta(property);
	};

});

angular.module('contactsApp')
.filter('JSON2vCard', function() {
	return function(input) {
		return vCard.generate(input);
	};
});

angular.module('contactsApp')
.filter('contactColor', function() {
	return function(input) {
		// Check if core has the new color generator
		if(typeof input.toHsl === 'function') {
			var hsl = input.toHsl();
			return 'hsl('+hsl[0]+', '+hsl[1]+'%, '+hsl[2]+'%)';
		} else {
			// If not, we use the old one
			/* global md5 */
			var hash = md5(input).substring(0, 4),
				maxRange = parseInt('ffff', 16),
				hue = parseInt(hash, 16) / maxRange * 256;
			return 'hsl(' + hue + ', 90%, 65%)';
		}
	};
});
angular.module('contactsApp')
.filter('contactGroupFilter', function() {
	'use strict';
	return function (contacts, group) {
		if (typeof contacts === 'undefined') {
			return contacts;
		}
		if (typeof group === 'undefined' || group.toLowerCase() === t('contacts', 'All contacts').toLowerCase()) {
			return contacts;
		}
		var filter = [];
		if (contacts.length > 0) {
			for (var i = 0; i < contacts.length; i++) {
				if (group.toLowerCase() === t('contacts', 'Not grouped').toLowerCase()) {
					if (contacts[i].categories().length === 0) {
						filter.push(contacts[i]);
					}
				} else {
					if (contacts[i].categories().indexOf(group) >= 0) {
						filter.push(contacts[i]);
					}
				}
			}
		}
		return filter.length === 0 ? contacts : filter;
	};
});

angular.module('contactsApp')
.filter('fieldFilter', function() {
	'use strict';
	return function (fields, contact) {
		if (typeof fields === 'undefined') {
			return fields;
		}
		if (typeof contact === 'undefined') {
			return fields;
		}
		var filter = [];
		if (fields.length > 0) {
			for (var i = 0; i < fields.length; i++) {
				if (fields[i].multiple ) {
					filter.push(fields[i]);
					continue;
				}
				if (_.isUndefined(contact.getProperty(fields[i].id))) {
					filter.push(fields[i]);
				}
			}
		}
		return filter;
	};
});

angular.module('contactsApp')
.filter('firstCharacter', function() {
	return function(input) {
		return input.charAt(0);
	};
});

angular.module('contactsApp')
.filter('localeOrderBy', [function () {
	return function (array, sortPredicate, reverseOrder) {
		if (!Array.isArray(array)) return array;
		if (!sortPredicate) return array;

		var arrayCopy = [];
		angular.forEach(array, function (item) {
			arrayCopy.push(item);
		});

		arrayCopy.sort(function (a, b) {
			var valueA = a[sortPredicate];
			if (angular.isFunction(valueA)) {
				valueA = a[sortPredicate]();
			}
			var valueB = b[sortPredicate];
			if (angular.isFunction(valueB)) {
				valueB = b[sortPredicate]();
			}

			if (angular.isString(valueA)) {
				return !reverseOrder ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
			}

			if (angular.isNumber(valueA) || angular.isBoolean(valueA)) {
				return !reverseOrder ? valueA - valueB : valueB - valueA;
			}

			return 0;
		});

		return arrayCopy;
	};
}]);


angular.module('contactsApp')
.filter('newContact', function() {
	return function(input) {
		return input !== '' ? input : t('contacts', 'New contact');
	};
});

angular.module('contactsApp')
.filter('orderDetailItems', ['vCardPropertiesService', function(vCardPropertiesService) {
	'use strict';
	return function(items, field, reverse) {

		var filtered = [];
		angular.forEach(items, function(item) {
			filtered.push(item);
		});

		var fieldOrder = angular.copy(vCardPropertiesService.fieldOrder);
		// reverse to move custom items to the end (indexOf == -1)
		fieldOrder.reverse();

		filtered.sort(function (a, b) {
			if(fieldOrder.indexOf(a[field]) < fieldOrder.indexOf(b[field])) {
				return 1;
			}
			if(fieldOrder.indexOf(a[field]) > fieldOrder.indexOf(b[field])) {
				return -1;
			}
			return 0;
		});

		if(reverse) filtered.reverse();
		return filtered;
	};
}]);

angular.module('contactsApp')
.filter('toArray', function() {
	return function(obj) {
		if (!(obj instanceof Object)) return obj;
		return _.map(obj, function(val, key) {
			return Object.defineProperty(val, '$key', {value: key});
		});
	};
});

angular.module('contactsApp')
.filter('vCard2JSON', function() {
	return function(input) {
		return vCard.parse(input);
	};
});

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJkYXRlcGlja2VyX2RpcmVjdGl2ZS5qcyIsImZvY3VzX2RpcmVjdGl2ZS5qcyIsImlucHV0cmVzaXplX2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rL2FkZHJlc3NCb29rX2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9vay9hZGRyZXNzQm9va19kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2RpcmVjdGl2ZS5qcyIsImF2YXRhci9hdmF0YXJfY29udHJvbGxlci5qcyIsImF2YXRhci9hdmF0YXJfZGlyZWN0aXZlLmpzIiwiY29udGFjdC9jb250YWN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0L2NvbnRhY3RfZGlyZWN0aXZlLmpzIiwiY29udGFjdERldGFpbHMvY29udGFjdERldGFpbHNfY29udHJvbGxlci5qcyIsImNvbnRhY3REZXRhaWxzL2NvbnRhY3REZXRhaWxzX2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RJbXBvcnQvY29udGFjdEltcG9ydF9jb250cm9sbGVyLmpzIiwiY29udGFjdEltcG9ydC9jb250YWN0SW1wb3J0X2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RMaXN0L2NvbnRhY3RMaXN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0TGlzdC9jb250YWN0TGlzdF9kaXJlY3RpdmUuanMiLCJkZXRhaWxzSXRlbS9kZXRhaWxzSXRlbV9jb250cm9sbGVyLmpzIiwiZGV0YWlsc0l0ZW0vZGV0YWlsc0l0ZW1fZGlyZWN0aXZlLmpzIiwiZ3JvdXAvZ3JvdXBfY29udHJvbGxlci5qcyIsImdyb3VwL2dyb3VwX2RpcmVjdGl2ZS5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfY29udHJvbGxlci5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfZGlyZWN0aXZlLmpzIiwicGFyc2Vycy9ncm91cE1vZGVsX2RpcmVjdGl2ZS5qcyIsInBhcnNlcnMvdGVsTW9kZWxfZGlyZWN0aXZlLmpzIiwiYWRkcmVzc0Jvb2tfbW9kZWwuanMiLCJjb250YWN0X21vZGVsLmpzIiwiYWRkcmVzc0Jvb2tfc2VydmljZS5qcyIsImNvbnRhY3Rfc2VydmljZS5qcyIsImRhdkNsaWVudF9zZXJ2aWNlLmpzIiwiZGF2X3NlcnZpY2UuanMiLCJzZWFyY2hfc2VydmljZS5qcyIsInNldHRpbmdzX3NlcnZpY2UuanMiLCJ2Q2FyZFByb3BlcnRpZXMuanMiLCJKU09OMnZDYXJkX2ZpbHRlci5qcyIsImNvbnRhY3RDb2xvcl9maWx0ZXIuanMiLCJjb250YWN0R3JvdXBfZmlsdGVyLmpzIiwiZmllbGRfZmlsdGVyLmpzIiwiZmlyc3RDaGFyYWN0ZXJfZmlsdGVyLmpzIiwibG9jYWxlT3JkZXJCeV9maWx0ZXIuanMiLCJuZXdDb250YWN0X2ZpbHRlci5qcyIsIm9yZGVyRGV0YWlsSXRlbXNfZmlsdGVyLmpzIiwidG9BcnJheV9maWx0ZXIuanMiLCJ2Q2FyZDJKU09OX2ZpbHRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztBQVVBLFFBQVEsT0FBTyxlQUFlLENBQUMsU0FBUyxpQkFBaUIsV0FBVyxnQkFBZ0IsYUFBYTtDQUNoRywwQkFBTyxTQUFTLGdCQUFnQjs7Q0FFaEMsZUFBZSxLQUFLLFNBQVM7RUFDNUIsVUFBVTs7O0NBR1gsZUFBZSxLQUFLLGNBQWM7RUFDakMsVUFBVTs7O0NBR1gsZUFBZSxVQUFVLE1BQU0sRUFBRSxZQUFZOzs7QUFHOUM7QUN4QkEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxjQUFjLFdBQVc7Q0FDbkMsT0FBTztFQUNOLFVBQVU7RUFDVixVQUFVO0VBQ1YsT0FBTyxVQUFVLE9BQU8sU0FBUyxPQUFPLGFBQWE7R0FDcEQsRUFBRSxXQUFXO0lBQ1osUUFBUSxXQUFXO0tBQ2xCLFdBQVc7S0FDWCxTQUFTO0tBQ1QsU0FBUztLQUNULFNBQVMsVUFBVSxNQUFNO01BQ3hCLFlBQVksY0FBYztNQUMxQixNQUFNOzs7Ozs7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QixPQUFPLFVBQVUsS0FBSyxRQUFRLEVBQUUsWUFBWTs7O0FBRzlDO0FDTkEsUUFBUSxPQUFPO0NBQ2QsT0FBTywrQ0FBb0IsU0FBUyx3QkFBd0I7Q0FDNUQ7Q0FDQSxPQUFPLFNBQVMsT0FBTyxPQUFPLFNBQVM7O0VBRXRDLElBQUksV0FBVztFQUNmLFFBQVEsUUFBUSxPQUFPLFNBQVMsTUFBTTtHQUNyQyxTQUFTLEtBQUs7OztFQUdmLElBQUksYUFBYSxRQUFRLEtBQUssdUJBQXVCOztFQUVyRCxXQUFXOztFQUVYLFNBQVMsS0FBSyxVQUFVLEdBQUcsR0FBRztHQUM3QixHQUFHLFdBQVcsUUFBUSxFQUFFLFVBQVUsV0FBVyxRQUFRLEVBQUUsU0FBUztJQUMvRCxPQUFPOztHQUVSLEdBQUcsV0FBVyxRQUFRLEVBQUUsVUFBVSxXQUFXLFFBQVEsRUFBRSxTQUFTO0lBQy9ELE9BQU8sQ0FBQzs7R0FFVCxPQUFPOzs7RUFHUixHQUFHLFNBQVMsU0FBUztFQUNyQixPQUFPOzs7QUFHVDtBQzVCQSxRQUFRLE9BQU87Q0FDZCxPQUFPLFdBQVcsV0FBVztDQUM3QixPQUFPLFNBQVMsS0FBSztFQUNwQixJQUFJLEVBQUUsZUFBZSxTQUFTLE9BQU87RUFDckMsT0FBTyxFQUFFLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSztHQUNwQyxPQUFPLE9BQU8sZUFBZSxLQUFLLFFBQVEsQ0FBQyxPQUFPOzs7O0FBSXJEO0FDVEEsUUFBUSxPQUFPO0NBQ2QsT0FBTyxjQUFjLFdBQVc7Q0FDaEMsT0FBTyxTQUFTLE9BQU87RUFDdEIsT0FBTyxNQUFNLE1BQU07OztBQUdyQiIsImZpbGUiOiJzY3JpcHQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIG93bkNsb3VkIC0gY29udGFjdHNcbiAqXG4gKiBUaGlzIGZpbGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEFmZmVybyBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIHZlcnNpb24gMyBvclxuICogbGF0ZXIuIFNlZSB0aGUgQ09QWUlORyBmaWxlLlxuICpcbiAqIEBhdXRob3IgSGVuZHJpayBMZXBwZWxzYWNrIDxoZW5kcmlrQGxlcHBlbHNhY2suZGU+XG4gKiBAY29weXJpZ2h0IEhlbmRyaWsgTGVwcGVsc2FjayAyMDE1XG4gKi9cblxuYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJywgWyd1dWlkNCcsICdhbmd1bGFyLWNhY2hlJywgJ25nUm91dGUnLCAndWkuYm9vdHN0cmFwJywgJ3VpLnNlbGVjdCcsICduZ1Nhbml0aXplJ10pXG4uY29uZmlnKGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKSB7XG5cblx0JHJvdXRlUHJvdmlkZXIud2hlbignLzpnaWQnLCB7XG5cdFx0dGVtcGxhdGU6ICc8Y29udGFjdGRldGFpbHM+PC9jb250YWN0ZGV0YWlscz4nXG5cdH0pO1xuXG5cdCRyb3V0ZVByb3ZpZGVyLndoZW4oJy86Z2lkLzp1aWQnLCB7XG5cdFx0dGVtcGxhdGU6ICc8Y29udGFjdGRldGFpbHM+PC9jb250YWN0ZGV0YWlscz4nXG5cdH0pO1xuXG5cdCRyb3V0ZVByb3ZpZGVyLm90aGVyd2lzZSgnLycgKyB0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2RhdGVwaWNrZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdHJlcXVpcmUgOiAnbmdNb2RlbCcsXG5cdFx0bGluayA6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIG5nTW9kZWxDdHJsKSB7XG5cdFx0XHQkKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRlbGVtZW50LmRhdGVwaWNrZXIoe1xuXHRcdFx0XHRcdGRhdGVGb3JtYXQ6J3l5LW1tLWRkJyxcblx0XHRcdFx0XHRtaW5EYXRlOiBudWxsLFxuXHRcdFx0XHRcdG1heERhdGU6IG51bGwsXG5cdFx0XHRcdFx0b25TZWxlY3Q6ZnVuY3Rpb24gKGRhdGUpIHtcblx0XHRcdFx0XHRcdG5nTW9kZWxDdHJsLiRzZXRWaWV3VmFsdWUoZGF0ZSk7XG5cdFx0XHRcdFx0XHRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZm9jdXNFeHByZXNzaW9uJywgZnVuY3Rpb24gKCR0aW1lb3V0KSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRsaW5rOiB7XG5cdFx0XHRwb3N0OiBmdW5jdGlvbiBwb3N0TGluayhzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcblx0XHRcdFx0c2NvcGUuJHdhdGNoKGF0dHJzLmZvY3VzRXhwcmVzc2lvbiwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmIChhdHRycy5mb2N1c0V4cHJlc3Npb24pIHtcblx0XHRcdFx0XHRcdGlmIChzY29wZS4kZXZhbChhdHRycy5mb2N1c0V4cHJlc3Npb24pKSB7XG5cdFx0XHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZWxlbWVudC5pcygnaW5wdXQnKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZWxlbWVudC5mb2N1cygpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRlbGVtZW50LmZpbmQoJ2lucHV0JykuZm9jdXMoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sIDEwMCk7IC8vbmVlZCBzb21lIGRlbGF5IHRvIHdvcmsgd2l0aCBuZy1kaXNhYmxlZFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnaW5wdXRyZXNpemUnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdGxpbmsgOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBlbElucHV0ID0gZWxlbWVudC52YWwoKTtcblx0XHRcdGVsZW1lbnQuYmluZCgna2V5ZG93biBrZXl1cCBsb2FkIGZvY3VzJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGVsSW5wdXQgPSBlbGVtZW50LnZhbCgpO1xuXHRcdFx0XHQvLyBJZiBzZXQgdG8gMCwgdGhlIG1pbi13aWR0aCBjc3MgZGF0YSBpcyBpZ25vcmVkXG5cdFx0XHRcdHZhciBsZW5ndGggPSBlbElucHV0Lmxlbmd0aCA+IDEgPyBlbElucHV0Lmxlbmd0aCA6IDE7XG5cdFx0XHRcdGVsZW1lbnQuYXR0cignc2l6ZScsIGxlbmd0aCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYWRkcmVzc2Jvb2tDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBBZGRyZXNzQm9va1NlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwuc2hvd1VybCA9IGZhbHNlO1xuXHQvKiBnbG9iYWxzIG9jX2NvbmZpZyAqL1xuXHQvKiBlc2xpbnQtZGlzYWJsZSBjYW1lbGNhc2UgKi9cblx0Y3RybC5jYW5FeHBvcnQgPSBvY19jb25maWcudmVyc2lvbnN0cmluZy5zcGxpdCgnLicpID49IFs5LCAwLCAyXTtcblx0LyogZXNsaW50LWVuYWJsZSBjYW1lbGNhc2UgKi9cblxuXHRjdHJsLnRvZ2dsZVNob3dVcmwgPSBmdW5jdGlvbigpIHtcblx0XHRjdHJsLnNob3dVcmwgPSAhY3RybC5zaG93VXJsO1xuXHR9O1xuXG5cdGN0cmwudG9nZ2xlU2hhcmVzRWRpdG9yID0gZnVuY3Rpb24oKSB7XG5cdFx0Y3RybC5lZGl0aW5nU2hhcmVzID0gIWN0cmwuZWRpdGluZ1NoYXJlcztcblx0XHRjdHJsLnNlbGVjdGVkU2hhcmVlID0gbnVsbDtcblx0fTtcblxuXHQvKiBGcm9tIENhbGVuZGFyLVJld29yayAtIGpzL2FwcC9jb250cm9sbGVycy9jYWxlbmRhcmxpc3Rjb250cm9sbGVyLmpzICovXG5cdGN0cmwuZmluZFNoYXJlZSA9IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gJC5nZXQoXG5cdFx0XHRPQy5saW5rVG9PQ1MoJ2FwcHMvZmlsZXNfc2hhcmluZy9hcGkvdjEnKSArICdzaGFyZWVzJyxcblx0XHRcdHtcblx0XHRcdFx0Zm9ybWF0OiAnanNvbicsXG5cdFx0XHRcdHNlYXJjaDogdmFsLnRyaW0oKSxcblx0XHRcdFx0cGVyUGFnZTogMjAwLFxuXHRcdFx0XHRpdGVtVHlwZTogJ3ByaW5jaXBhbHMnXG5cdFx0XHR9XG5cdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0Ly8gVG9kbyAtIGZpbHRlciBvdXQgY3VycmVudCB1c2VyLCBleGlzdGluZyBzaGFyZWVzXG5cdFx0XHR2YXIgdXNlcnMgICA9IHJlc3VsdC5vY3MuZGF0YS5leGFjdC51c2Vycy5jb25jYXQocmVzdWx0Lm9jcy5kYXRhLnVzZXJzKTtcblx0XHRcdHZhciBncm91cHMgID0gcmVzdWx0Lm9jcy5kYXRhLmV4YWN0Lmdyb3Vwcy5jb25jYXQocmVzdWx0Lm9jcy5kYXRhLmdyb3Vwcyk7XG5cblx0XHRcdHZhciB1c2VyU2hhcmVzID0gY3RybC5hZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzO1xuXHRcdFx0dmFyIHVzZXJTaGFyZXNMZW5ndGggPSB1c2VyU2hhcmVzLmxlbmd0aDtcblx0XHRcdHZhciBpLCBqO1xuXG5cdFx0XHQvLyBGaWx0ZXIgb3V0IGN1cnJlbnQgdXNlclxuXHRcdFx0dmFyIHVzZXJzTGVuZ3RoID0gdXNlcnMubGVuZ3RoO1xuXHRcdFx0Zm9yIChpID0gMCA7IGkgPCB1c2Vyc0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICh1c2Vyc1tpXS52YWx1ZS5zaGFyZVdpdGggPT09IE9DLmN1cnJlbnRVc2VyKSB7XG5cdFx0XHRcdFx0dXNlcnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIE5vdyBmaWx0ZXIgb3V0IGFsbCBzaGFyZWVzIHRoYXQgYXJlIGFscmVhZHkgc2hhcmVkIHdpdGhcblx0XHRcdGZvciAoaSA9IDA7IGkgPCB1c2VyU2hhcmVzTGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dmFyIHNoYXJlID0gdXNlclNoYXJlc1tpXTtcblx0XHRcdFx0dXNlcnNMZW5ndGggPSB1c2Vycy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoaiA9IDA7IGogPCB1c2Vyc0xlbmd0aDsgaisrKSB7XG5cdFx0XHRcdFx0aWYgKHVzZXJzW2pdLnZhbHVlLnNoYXJlV2l0aCA9PT0gc2hhcmUuaWQpIHtcblx0XHRcdFx0XHRcdHVzZXJzLnNwbGljZShqLCAxKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBDb21iaW5lIHVzZXJzIGFuZCBncm91cHNcblx0XHRcdHVzZXJzID0gdXNlcnMubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkaXNwbGF5OiBpdGVtLnZhbHVlLnNoYXJlV2l0aCxcblx0XHRcdFx0XHR0eXBlOiBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIsXG5cdFx0XHRcdFx0aWRlbnRpZmllcjogaXRlbS52YWx1ZS5zaGFyZVdpdGhcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0XHRncm91cHMgPSBncm91cHMubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkaXNwbGF5OiBpdGVtLnZhbHVlLnNoYXJlV2l0aCArICcgKGdyb3VwKScsXG5cdFx0XHRcdFx0dHlwZTogT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCxcblx0XHRcdFx0XHRpZGVudGlmaWVyOiBpdGVtLnZhbHVlLnNoYXJlV2l0aFxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBncm91cHMuY29uY2F0KHVzZXJzKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLm9uU2VsZWN0U2hhcmVlID0gZnVuY3Rpb24gKGl0ZW0pIHtcblx0XHRjdHJsLnNlbGVjdGVkU2hhcmVlID0gbnVsbDtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2Uuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgaXRlbS50eXBlLCBpdGVtLmlkZW50aWZpZXIsIGZhbHNlLCBmYWxzZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblxuXHR9O1xuXG5cdGN0cmwudXBkYXRlRXhpc3RpbmdVc2VyU2hhcmUgPSBmdW5jdGlvbih1c2VySWQsIHdyaXRhYmxlKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUiwgdXNlcklkLCB3cml0YWJsZSwgdHJ1ZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVwZGF0ZUV4aXN0aW5nR3JvdXBTaGFyZSA9IGZ1bmN0aW9uKGdyb3VwSWQsIHdyaXRhYmxlKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsIGdyb3VwSWQsIHdyaXRhYmxlLCB0cnVlKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudW5zaGFyZUZyb21Vc2VyID0gZnVuY3Rpb24odXNlcklkKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnVuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSLCB1c2VySWQpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51bnNoYXJlRnJvbUdyb3VwID0gZnVuY3Rpb24oZ3JvdXBJZCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS51bnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsIGdyb3VwSWQpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5kZWxldGVBZGRyZXNzQm9vayA9IGZ1bmN0aW9uKCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5kZWxldGUoY3RybC5hZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYWRkcmVzc2Jvb2snLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLCAvLyBoYXMgdG8gYmUgYW4gYXR0cmlidXRlIHRvIHdvcmsgd2l0aCBjb3JlIGNzc1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnYWRkcmVzc2Jvb2tDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7XG5cdFx0XHRhZGRyZXNzQm9vazogJz1kYXRhJyxcblx0XHRcdGxpc3Q6ICc9J1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2FkZHJlc3NCb29rLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2FkZHJlc3Nib29rbGlzdEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIEFkZHJlc3NCb29rU2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblxuXHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRjdHJsLmFkZHJlc3NCb29rcyA9IGFkZHJlc3NCb29rcztcblx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0fSk7XG5cblx0Y3RybC50ID0ge1xuXHRcdGFkZHJlc3NCb29rTmFtZSA6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MgYm9vayBuYW1lJylcblx0fTtcblxuXHRjdHJsLmNyZWF0ZUFkZHJlc3NCb29rID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYoY3RybC5uZXdBZGRyZXNzQm9va05hbWUpIHtcblx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5jcmVhdGUoY3RybC5uZXdBZGRyZXNzQm9va05hbWUpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5nZXRBZGRyZXNzQm9vayhjdHJsLm5ld0FkZHJlc3NCb29rTmFtZSkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdGN0cmwuYWRkcmVzc0Jvb2tzLnB1c2goYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdhZGRyZXNzYm9va2xpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rbGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9va0xpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYXZhdGFyQ3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmltcG9ydCA9IENvbnRhY3RTZXJ2aWNlLmltcG9ydC5iaW5kKENvbnRhY3RTZXJ2aWNlKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYXZhdGFyJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBpbXBvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnSW1wb3J0Jyk7XG5cdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblxuXHRcdFx0dmFyIGlucHV0ID0gZWxlbWVudC5maW5kKCdpbnB1dCcpO1xuXHRcdFx0aW5wdXQuYmluZCgnY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlID0gaW5wdXQuZ2V0KDApLmZpbGVzWzBdO1xuXHRcdFx0XHRpZiAoZmlsZS5zaXplID4gMTAyNCoxMDI0KSB7IC8vIDEgTUJcblx0XHRcdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdUaGUgc2VsZWN0ZWQgaW1hZ2UgaXMgdG9vIGJpZyAobWF4IDFNQiknKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0c2NvcGUuY29udGFjdC5waG90byhyZWFkZXIucmVzdWx0KTtcblx0XHRcdFx0XHRcdFx0Q29udGFjdFNlcnZpY2UudXBkYXRlKHNjb3BlLmNvbnRhY3QpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYXZhdGFyLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RDdHJsJywgZnVuY3Rpb24oJHJvdXRlLCAkcm91dGVQYXJhbXMpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwub3BlbkNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdHVpZDogY3RybC5jb250YWN0LnVpZCgpfSk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0Q3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2NvbnRhY3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGRldGFpbHNDdHJsJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UsIEFkZHJlc3NCb29rU2VydmljZSwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgJHJvdXRlLCAkcm91dGVQYXJhbXMsICRzY29wZSkge1xuXG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmxvYWRpbmcgPSB0cnVlO1xuXHRjdHJsLnNob3cgPSBmYWxzZTtcblxuXHRjdHJsLmNsZWFyQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0dWlkOiB1bmRlZmluZWRcblx0XHR9KTtcblx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHRjdHJsLmNvbnRhY3QgPSB1bmRlZmluZWQ7XG5cdH07XG5cblx0Y3RybC51aWQgPSAkcm91dGVQYXJhbXMudWlkO1xuXHRjdHJsLnQgPSB7XG5cdFx0bm9Db250YWN0cyA6IHQoJ2NvbnRhY3RzJywgJ05vIGNvbnRhY3RzIGluIGhlcmUnKSxcblx0XHRwbGFjZWhvbGRlck5hbWUgOiB0KCdjb250YWN0cycsICdOYW1lJyksXG5cdFx0cGxhY2Vob2xkZXJPcmcgOiB0KCdjb250YWN0cycsICdPcmdhbml6YXRpb24nKSxcblx0XHRwbGFjZWhvbGRlclRpdGxlIDogdCgnY29udGFjdHMnLCAnVGl0bGUnKSxcblx0XHRzZWxlY3RGaWVsZCA6IHQoJ2NvbnRhY3RzJywgJ0FkZCBmaWVsZCAuLi4nKVxuXHR9O1xuXG5cdGN0cmwuZmllbGREZWZpbml0aW9ucyA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZmllbGREZWZpbml0aW9ucztcblx0Y3RybC5mb2N1cyA9IHVuZGVmaW5lZDtcblx0Y3RybC5maWVsZCA9IHVuZGVmaW5lZDtcblx0Y3RybC5hZGRyZXNzQm9va3MgPSBbXTtcblxuXHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRjdHJsLmFkZHJlc3NCb29rcyA9IGFkZHJlc3NCb29rcztcblxuXHRcdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmNvbnRhY3QpKSB7XG5cdFx0XHRjdHJsLmFkZHJlc3NCb29rID0gXy5maW5kKGN0cmwuYWRkcmVzc0Jvb2tzLCBmdW5jdGlvbihib29rKSB7XG5cdFx0XHRcdHJldHVybiBib29rLmRpc3BsYXlOYW1lID09PSBjdHJsLmNvbnRhY3QuYWRkcmVzc0Jvb2tJZDtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC51aWQnLCBmdW5jdGlvbihuZXdWYWx1ZSkge1xuXHRcdGN0cmwuY2hhbmdlQ29udGFjdChuZXdWYWx1ZSk7XG5cdH0pO1xuXG5cdGN0cmwuY2hhbmdlQ29udGFjdCA9IGZ1bmN0aW9uKHVpZCkge1xuXHRcdGlmICh0eXBlb2YgdWlkID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y3RybC5zaG93ID0gZmFsc2U7XG5cdFx0XHQkKCcjYXBwLW5hdmlnYXRpb24tdG9nZ2xlJykucmVtb3ZlQ2xhc3MoJ3Nob3dkZXRhaWxzJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdENvbnRhY3RTZXJ2aWNlLmdldEJ5SWQodWlkKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKGNvbnRhY3QpKSB7XG5cdFx0XHRcdGN0cmwuY2xlYXJDb250YWN0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGN0cmwuY29udGFjdCA9IGNvbnRhY3Q7XG5cdFx0XHRjdHJsLnNob3cgPSB0cnVlO1xuXHRcdFx0JCgnI2FwcC1uYXZpZ2F0aW9uLXRvZ2dsZScpLmFkZENsYXNzKCdzaG93ZGV0YWlscycpO1xuXG5cdFx0XHRjdHJsLmFkZHJlc3NCb29rID0gXy5maW5kKGN0cmwuYWRkcmVzc0Jvb2tzLCBmdW5jdGlvbihib29rKSB7XG5cdFx0XHRcdHJldHVybiBib29rLmRpc3BsYXlOYW1lID09PSBjdHJsLmNvbnRhY3QuYWRkcmVzc0Jvb2tJZDtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudXBkYXRlQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdENvbnRhY3RTZXJ2aWNlLnVwZGF0ZShjdHJsLmNvbnRhY3QpO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdENvbnRhY3RTZXJ2aWNlLmRlbGV0ZShjdHJsLmNvbnRhY3QpO1xuXHR9O1xuXG5cdGN0cmwuYWRkRmllbGQgPSBmdW5jdGlvbihmaWVsZCkge1xuXHRcdHZhciBkZWZhdWx0VmFsdWUgPSB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmdldE1ldGEoZmllbGQpLmRlZmF1bHRWYWx1ZSB8fCB7dmFsdWU6ICcnfTtcblx0XHRjdHJsLmNvbnRhY3QuYWRkUHJvcGVydHkoZmllbGQsIGRlZmF1bHRWYWx1ZSk7XG5cdFx0Y3RybC5mb2N1cyA9IGZpZWxkO1xuXHRcdGN0cmwuZmllbGQgPSAnJztcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKGZpZWxkLCBwcm9wKSB7XG5cdFx0Y3RybC5jb250YWN0LnJlbW92ZVByb3BlcnR5KGZpZWxkLCBwcm9wKTtcblx0XHRjdHJsLmZvY3VzID0gdW5kZWZpbmVkO1xuXHR9O1xuXG5cdGN0cmwuY2hhbmdlQWRkcmVzc0Jvb2sgPSBmdW5jdGlvbiAoYWRkcmVzc0Jvb2spIHtcblx0XHRDb250YWN0U2VydmljZS5tb3ZlQ29udGFjdChjdHJsLmNvbnRhY3QsIGFkZHJlc3NCb29rKTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RkZXRhaWxzJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0ZGV0YWlsc0N0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0RGV0YWlscy5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdjb250YWN0aW1wb3J0Q3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmltcG9ydCA9IENvbnRhY3RTZXJ2aWNlLmltcG9ydC5iaW5kKENvbnRhY3RTZXJ2aWNlKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdGltcG9ydCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHJldHVybiB7XG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBpbXBvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnSW1wb3J0Jyk7XG5cdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblxuXHRcdFx0dmFyIGlucHV0ID0gZWxlbWVudC5maW5kKCdpbnB1dCcpO1xuXHRcdFx0aW5wdXQuYmluZCgnY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlID0gaW5wdXQuZ2V0KDApLmZpbGVzWzBdO1xuXHRcdFx0XHR2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblxuXHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRDb250YWN0U2VydmljZS5pbXBvcnQuY2FsbChDb250YWN0U2VydmljZSwgcmVhZGVyLnJlc3VsdCwgZmlsZS50eXBlLCBudWxsLCBmdW5jdGlvbihwcm9ncmVzcykge1xuXHRcdFx0XHRcdFx0XHRpZihwcm9ncmVzcz09PTEpIHtcblx0XHRcdFx0XHRcdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gcGFyc2VJbnQoTWF0aC5mbG9vcihwcm9ncmVzcyoxMDApKSsnJSc7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9LCBmYWxzZSk7XG5cblx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRyZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdEltcG9ydC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdjb250YWN0bGlzdEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsICRmaWx0ZXIsICRyb3V0ZSwgJHJvdXRlUGFyYW1zLCBDb250YWN0U2VydmljZSwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgU2VhcmNoU2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5yb3V0ZVBhcmFtcyA9ICRyb3V0ZVBhcmFtcztcblxuXHRjdHJsLmNvbnRhY3RMaXN0ID0gW107XG5cdGN0cmwuc2VhcmNoVGVybSA9ICcnO1xuXHRjdHJsLnNob3cgPSB0cnVlO1xuXHRjdHJsLmludmFsaWQgPSBmYWxzZTtcblxuXHRjdHJsLnQgPSB7XG5cdFx0YWRkQ29udGFjdCA6IHQoJ2NvbnRhY3RzJywgJ0FkZCBjb250YWN0JyksXG5cdFx0ZW1wdHlTZWFyY2ggOiB0KCdjb250YWN0cycsICdObyBzZWFyY2ggcmVzdWx0IGZvciB7cXVlcnl9Jywge3F1ZXJ5OiBjdHJsLnNlYXJjaFRlcm19KVxuXHR9O1xuXG5cblx0JHNjb3BlLnF1ZXJ5ID0gZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdHJldHVybiBjb250YWN0Lm1hdGNoZXMoU2VhcmNoU2VydmljZS5nZXRTZWFyY2hUZXJtKCkpO1xuXHR9O1xuXG5cdFNlYXJjaFNlcnZpY2UucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrKGZ1bmN0aW9uKGV2KSB7XG5cdFx0aWYgKGV2LmV2ZW50ID09PSAnc3VibWl0U2VhcmNoJykge1xuXHRcdFx0dmFyIHVpZCA9ICFfLmlzRW1wdHkoY3RybC5jb250YWN0TGlzdCkgPyBjdHJsLmNvbnRhY3RMaXN0WzBdLnVpZCgpIDogdW5kZWZpbmVkO1xuXHRcdFx0Y3RybC5zZXRTZWxlY3RlZElkKHVpZCk7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fVxuXHRcdGlmIChldi5ldmVudCA9PT0gJ2NoYW5nZVNlYXJjaCcpIHtcblx0XHRcdGN0cmwuc2VhcmNoVGVybSA9IGV2LnNlYXJjaFRlcm07XG5cdFx0XHRjdHJsLnQuZW1wdHlTZWFyY2ggPSB0KCdjb250YWN0cycsXG5cdFx0XHRcdFx0XHRcdFx0ICAgJ05vIHNlYXJjaCByZXN1bHQgZm9yIHtxdWVyeX0nLFxuXHRcdFx0XHRcdFx0XHRcdCAgIHtxdWVyeTogY3RybC5zZWFyY2hUZXJtfVxuXHRcdFx0XHRcdFx0XHRcdCAgKTtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cblx0Q29udGFjdFNlcnZpY2UucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrKGZ1bmN0aW9uKGV2KSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdGlmIChldi5ldmVudCA9PT0gJ2RlbGV0ZScpIHtcblx0XHRcdFx0aWYgKGN0cmwuY29udGFjdExpc3QubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0XHR1aWQ6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZvciAodmFyIGkgPSAwLCBsZW5ndGggPSBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRpZiAoY3RybC5jb250YWN0TGlzdFtpXS51aWQoKSA9PT0gZXYudWlkKSB7XG5cdFx0XHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdFx0XHR1aWQ6IChjdHJsLmNvbnRhY3RMaXN0W2krMV0pID8gY3RybC5jb250YWN0TGlzdFtpKzFdLnVpZCgpIDogY3RybC5jb250YWN0TGlzdFtpLTFdLnVpZCgpXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGV2LmV2ZW50ID09PSAnY3JlYXRlJykge1xuXHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0dWlkOiBldi51aWRcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmNvbnRhY3RzID0gZXYuY29udGFjdHM7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIEdldCBjb250YWN0c1xuXHRDb250YWN0U2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3RzKSB7XG5cdFx0aWYoY29udGFjdHMubGVuZ3RoPjApIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGN0cmwuY29udGFjdHMgPSBjb250YWN0cztcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdhaXQgZm9yIGN0cmwuY29udGFjdExpc3QgdG8gYmUgdXBkYXRlZCwgbG9hZCB0aGUgZmlyc3QgY29udGFjdCBhbmQga2lsbCB0aGUgd2F0Y2hcblx0dmFyIHVuYmluZExpc3RXYXRjaCA9ICRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3QnLCBmdW5jdGlvbigpIHtcblx0XHRpZihjdHJsLmNvbnRhY3RMaXN0ICYmIGN0cmwuY29udGFjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0Ly8gQ2hlY2sgaWYgYSBzcGVjaWZpYyB1aWQgaXMgcmVxdWVzdGVkXG5cdFx0XHRpZigkcm91dGVQYXJhbXMudWlkICYmICRyb3V0ZVBhcmFtcy5naWQpIHtcblx0XHRcdFx0Y3RybC5jb250YWN0TGlzdC5mb3JFYWNoKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFx0XHRpZihjb250YWN0LnVpZCgpID09PSAkcm91dGVQYXJhbXMudWlkKSB7XG5cdFx0XHRcdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQoJHJvdXRlUGFyYW1zLnVpZCk7XG5cdFx0XHRcdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Ly8gTm8gY29udGFjdCBwcmV2aW91c2x5IGxvYWRlZCwgbGV0J3MgbG9hZCB0aGUgZmlyc3Qgb2YgdGhlIGxpc3QgaWYgbm90IGluIG1vYmlsZSBtb2RlXG5cdFx0XHRpZihjdHJsLmxvYWRpbmcgJiYgJCh3aW5kb3cpLndpZHRoKCkgPiA3NjgpIHtcblx0XHRcdFx0Y3RybC5zZXRTZWxlY3RlZElkKGN0cmwuY29udGFjdExpc3RbMF0udWlkKCkpO1xuXHRcdFx0fVxuXHRcdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdFx0XHR1bmJpbmRMaXN0V2F0Y2goKTtcblx0XHR9XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwucm91dGVQYXJhbXMudWlkJywgZnVuY3Rpb24obmV3VmFsdWUsIG9sZFZhbHVlKSB7XG5cdFx0Ly8gVXNlZCBmb3IgbW9iaWxlIHZpZXcgdG8gY2xlYXIgdGhlIHVybFxuXHRcdGlmKHR5cGVvZiBvbGRWYWx1ZSAhPSAndW5kZWZpbmVkJyAmJiB0eXBlb2YgbmV3VmFsdWUgPT0gJ3VuZGVmaW5lZCcgJiYgJCh3aW5kb3cpLndpZHRoKCkgPD0gNzY4KSB7XG5cdFx0XHQvLyBubyBjb250YWN0IHNlbGVjdGVkXG5cdFx0XHRjdHJsLnNob3cgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZihuZXdWYWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyB3ZSBtaWdodCBoYXZlIHRvIHdhaXQgdW50aWwgbmctcmVwZWF0IGZpbGxlZCB0aGUgY29udGFjdExpc3Rcblx0XHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHR1aWQ6IGN0cmwuY29udGFjdExpc3RbMF0udWlkKClcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyB3YXRjaCBmb3IgbmV4dCBjb250YWN0TGlzdCB1cGRhdGVcblx0XHRcdFx0dmFyIHVuYmluZFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0XHR1aWQ6IGN0cmwuY29udGFjdExpc3RbMF0udWlkKClcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR1bmJpbmRXYXRjaCgpOyAvLyB1bmJpbmQgYXMgd2Ugb25seSB3YW50IG9uZSB1cGRhdGVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGRpc3BsYXlpbmcgY29udGFjdCBkZXRhaWxzXG5cdFx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHR9XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwucm91dGVQYXJhbXMuZ2lkJywgZnVuY3Rpb24oKSB7XG5cdFx0Ly8gd2UgbWlnaHQgaGF2ZSB0byB3YWl0IHVudGlsIG5nLXJlcGVhdCBmaWxsZWQgdGhlIGNvbnRhY3RMaXN0XG5cdFx0Y3RybC5jb250YWN0TGlzdCA9IFtdO1xuXHRcdC8vIG5vdCBpbiBtb2JpbGUgbW9kZVxuXHRcdGlmKCQod2luZG93KS53aWR0aCgpID4gNzY4KSB7XG5cdFx0XHQvLyB3YXRjaCBmb3IgbmV4dCBjb250YWN0TGlzdCB1cGRhdGVcblx0XHRcdHZhciB1bmJpbmRXYXRjaCA9ICRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3QnLCBmdW5jdGlvbigpIHtcblx0XHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHVuYmluZFdhdGNoKCk7IC8vIHVuYmluZCBhcyB3ZSBvbmx5IHdhbnQgb25lIHVwZGF0ZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblxuXHQvLyBXYXRjaCBpZiB3ZSBoYXZlIGFuIGludmFsaWQgY29udGFjdFxuXHQkc2NvcGUuJHdhdGNoKCdjdHJsLmNvbnRhY3RMaXN0WzBdLmRpc3BsYXlOYW1lKCknLCBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdGN0cmwuaW52YWxpZCA9IChkaXNwbGF5TmFtZSA9PT0gJycpO1xuXHR9KTtcblxuXHRjdHJsLmNyZWF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5jcmVhdGUoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFsndGVsJywgJ2FkcicsICdlbWFpbCddLmZvckVhY2goZnVuY3Rpb24oZmllbGQpIHtcblx0XHRcdFx0dmFyIGRlZmF1bHRWYWx1ZSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShmaWVsZCkuZGVmYXVsdFZhbHVlIHx8IHt2YWx1ZTogJyd9O1xuXHRcdFx0XHRjb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV0uaW5kZXhPZigkcm91dGVQYXJhbXMuZ2lkKSA9PT0gLTEpIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCRyb3V0ZVBhcmFtcy5naWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCcnKTtcblx0XHRcdH1cblx0XHRcdCQoJyNkZXRhaWxzLWZ1bGxOYW1lJykuZm9jdXMoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLmhhc0NvbnRhY3RzID0gZnVuY3Rpb24gKCkge1xuXHRcdGlmICghY3RybC5jb250YWN0cykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gY3RybC5jb250YWN0cy5sZW5ndGggPiAwO1xuXHR9O1xuXG5cdGN0cmwuc2V0U2VsZWN0ZWRJZCA9IGZ1bmN0aW9uIChjb250YWN0SWQpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdHVpZDogY29udGFjdElkXG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5nZXRTZWxlY3RlZElkID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuICRyb3V0ZVBhcmFtcy51aWQ7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0bGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGFkZHJlc3Nib29rOiAnPWFkcmJvb2snXG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdExpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignZGV0YWlsc0l0ZW1DdHJsJywgZnVuY3Rpb24oJHRlbXBsYXRlUmVxdWVzdCwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgQ29udGFjdFNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubWV0YSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShjdHJsLm5hbWUpO1xuXHRjdHJsLnR5cGUgPSB1bmRlZmluZWQ7XG5cdGN0cmwuaXNQcmVmZXJyZWQgPSBmYWxzZTtcblx0Y3RybC50ID0ge1xuXHRcdHBvQm94IDogdCgnY29udGFjdHMnLCAnUG9zdCBvZmZpY2UgYm94JyksXG5cdFx0cG9zdGFsQ29kZSA6IHQoJ2NvbnRhY3RzJywgJ1Bvc3RhbCBjb2RlJyksXG5cdFx0Y2l0eSA6IHQoJ2NvbnRhY3RzJywgJ0NpdHknKSxcblx0XHRzdGF0ZSA6IHQoJ2NvbnRhY3RzJywgJ1N0YXRlIG9yIHByb3ZpbmNlJyksXG5cdFx0Y291bnRyeSA6IHQoJ2NvbnRhY3RzJywgJ0NvdW50cnknKSxcblx0XHRhZGRyZXNzOiB0KCdjb250YWN0cycsICdBZGRyZXNzJyksXG5cdFx0bmV3R3JvdXA6IHQoJ2NvbnRhY3RzJywgJyhuZXcgZ3JvdXApJyksXG5cdFx0ZmFtaWx5TmFtZTogdCgnY29udGFjdHMnLCAnTGFzdCBuYW1lJyksXG5cdFx0Zmlyc3ROYW1lOiB0KCdjb250YWN0cycsICdGaXJzdCBuYW1lJyksXG5cdFx0YWRkaXRpb25hbE5hbWVzOiB0KCdjb250YWN0cycsICdBZGRpdGlvbmFsIG5hbWVzJyksXG5cdFx0aG9ub3JpZmljUHJlZml4OiB0KCdjb250YWN0cycsICdQcmVmaXgnKSxcblx0XHRob25vcmlmaWNTdWZmaXg6IHQoJ2NvbnRhY3RzJywgJ1N1ZmZpeCcpXG5cdH07XG5cblx0Y3RybC5hdmFpbGFibGVPcHRpb25zID0gY3RybC5tZXRhLm9wdGlvbnMgfHwgW107XG5cdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5tZXRhKSAmJiAhXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEubWV0YS50eXBlKSkge1xuXHRcdC8vIHBhcnNlIHR5cGUgb2YgdGhlIHByb3BlcnR5XG5cdFx0dmFyIGFycmF5ID0gY3RybC5kYXRhLm1ldGEudHlwZVswXS5zcGxpdCgnLCcpO1xuXHRcdGFycmF5ID0gYXJyYXkubWFwKGZ1bmN0aW9uIChlbGVtKSB7XG5cdFx0XHRyZXR1cm4gZWxlbS50cmltKCkucmVwbGFjZSgvXFwvKyQvLCAnJykucmVwbGFjZSgvXFxcXCskLywgJycpLnRyaW0oKS50b1VwcGVyQ2FzZSgpO1xuXHRcdH0pO1xuXHRcdC8vIHRoZSBwcmVmIHZhbHVlIGlzIGhhbmRsZWQgb24gaXRzIG93biBzbyB0aGF0IHdlIGNhbiBhZGQgc29tZSBmYXZvcml0ZSBpY29uIHRvIHRoZSB1aSBpZiB3ZSB3YW50XG5cdFx0aWYgKGFycmF5LmluZGV4T2YoJ1BSRUYnKSA+PSAwKSB7XG5cdFx0XHRjdHJsLmlzUHJlZmVycmVkID0gdHJ1ZTtcblx0XHRcdGFycmF5LnNwbGljZShhcnJheS5pbmRleE9mKCdQUkVGJyksIDEpO1xuXHRcdH1cblx0XHQvLyBzaW1wbHkgam9pbiB0aGUgdXBwZXIgY2FzZWQgdHlwZXMgdG9nZXRoZXIgYXMga2V5XG5cdFx0Y3RybC50eXBlID0gYXJyYXkuam9pbignLCcpO1xuXHRcdHZhciBkaXNwbGF5TmFtZSA9IGFycmF5Lm1hcChmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIGVsZW1lbnQuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBlbGVtZW50LnNsaWNlKDEpLnRvTG93ZXJDYXNlKCk7XG5cdFx0fSkuam9pbignICcpO1xuXG5cdFx0Ly8gaW4gY2FzZSB0aGUgdHlwZSBpcyBub3QgeWV0IGluIHRoZSBkZWZhdWx0IGxpc3Qgb2YgYXZhaWxhYmxlIG9wdGlvbnMgd2UgYWRkIGl0XG5cdFx0aWYgKCFjdHJsLmF2YWlsYWJsZU9wdGlvbnMuc29tZShmdW5jdGlvbihlKSB7IHJldHVybiBlLmlkID09PSBjdHJsLnR5cGU7IH0gKSkge1xuXHRcdFx0Y3RybC5hdmFpbGFibGVPcHRpb25zID0gY3RybC5hdmFpbGFibGVPcHRpb25zLmNvbmNhdChbe2lkOiBjdHJsLnR5cGUsIG5hbWU6IGRpc3BsYXlOYW1lfV0pO1xuXHRcdH1cblx0fVxuXHRjdHJsLmF2YWlsYWJsZUdyb3VwcyA9IFtdO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5hdmFpbGFibGVHcm91cHMgPSBfLnVuaXF1ZShncm91cHMpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZVR5cGUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0aWYgKGN0cmwuaXNQcmVmZXJyZWQpIHtcblx0XHRcdHZhbCArPSAnLFBSRUYnO1xuXHRcdH1cblx0XHRjdHJsLmRhdGEubWV0YSA9IGN0cmwuZGF0YS5tZXRhIHx8IHt9O1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGUgPSBjdHJsLmRhdGEubWV0YS50eXBlIHx8IFtdO1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGVbMF0gPSB2YWw7XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVEZXRhaWxlZE5hbWUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZuID0gJyc7XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVszXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzNdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzFdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbMV0gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbMl0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVsyXSArICcgJztcblx0XHR9XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVswXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzBdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzRdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbNF07XG5cdFx0fVxuXG5cdFx0Y3RybC5tb2RlbC5jb250YWN0LmZ1bGxOYW1lKGZuKTtcblx0XHRjdHJsLm1vZGVsLnVwZGF0ZUNvbnRhY3QoKTtcblx0fTtcblxuXHRjdHJsLmdldFRlbXBsYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRlbXBsYXRlVXJsID0gT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZGV0YWlsSXRlbXMvJyArIGN0cmwubWV0YS50ZW1wbGF0ZSArICcuaHRtbCcpO1xuXHRcdHJldHVybiAkdGVtcGxhdGVSZXF1ZXN0KHRlbXBsYXRlVXJsKTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwubW9kZWwuZGVsZXRlRmllbGQoY3RybC5uYW1lLCBjdHJsLmRhdGEpO1xuXHRcdGN0cmwubW9kZWwudXBkYXRlQ29udGFjdCgpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZGV0YWlsc2l0ZW0nLCBbJyRjb21waWxlJywgZnVuY3Rpb24oJGNvbXBpbGUpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2RldGFpbHNJdGVtQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0bmFtZTogJz0nLFxuXHRcdFx0ZGF0YTogJz0nLFxuXHRcdFx0bW9kZWw6ICc9J1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XG5cdFx0XHRjdHJsLmdldFRlbXBsYXRlKCkudGhlbihmdW5jdGlvbihodG1sKSB7XG5cdFx0XHRcdHZhciB0ZW1wbGF0ZSA9IGFuZ3VsYXIuZWxlbWVudChodG1sKTtcblx0XHRcdFx0ZWxlbWVudC5hcHBlbmQodGVtcGxhdGUpO1xuXHRcdFx0XHQkY29tcGlsZSh0ZW1wbGF0ZSkoc2NvcGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufV0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cEN0cmwnLCBmdW5jdGlvbigpIHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5cdHZhciBjdHJsID0gdGhpcztcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2dyb3VwJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2dyb3VwQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Z3JvdXA6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9ncm91cC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgU2VhcmNoU2VydmljZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHR2YXIgaW5pdGlhbEdyb3VwcyA9IFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV07XG5cblx0Y3RybC5ncm91cHMgPSBpbml0aWFsR3JvdXBzO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5ncm91cHMgPSBfLnVuaXF1ZShpbml0aWFsR3JvdXBzLmNvbmNhdChncm91cHMpKTtcblx0fSk7XG5cblx0Y3RybC5nZXRTZWxlY3RlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAkcm91dGVQYXJhbXMuZ2lkO1xuXHR9O1xuXG5cdC8vIFVwZGF0ZSBncm91cExpc3Qgb24gY29udGFjdCBhZGQvZGVsZXRlL3VwZGF0ZVxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oKSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0XHRcdGN0cmwuZ3JvdXBzID0gXy51bmlxdWUoaW5pdGlhbEdyb3Vwcy5jb25jYXQoZ3JvdXBzKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Y3RybC5zZXRTZWxlY3RlZCA9IGZ1bmN0aW9uIChzZWxlY3RlZEdyb3VwKSB7XG5cdFx0U2VhcmNoU2VydmljZS5jbGVhblNlYXJjaCgpO1xuXHRcdCRyb3V0ZVBhcmFtcy5naWQgPSBzZWxlY3RlZEdyb3VwO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdncm91cGxpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZ3JvdXBMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBNb2RlbCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm57XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRyZXF1aXJlOiAnbmdNb2RlbCcsXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHIsIG5nTW9kZWwpIHtcblx0XHRcdG5nTW9kZWwuJGZvcm1hdHRlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAodmFsdWUudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmFsdWUuc3BsaXQoJywnKTtcblx0XHRcdH0pO1xuXHRcdFx0bmdNb2RlbC4kcGFyc2Vycy5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS5qb2luKCcsJyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCd0ZWxNb2RlbCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm57XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRyZXF1aXJlOiAnbmdNb2RlbCcsXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHIsIG5nTW9kZWwpIHtcblx0XHRcdG5nTW9kZWwuJGZvcm1hdHRlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9KTtcblx0XHRcdG5nTW9kZWwuJHBhcnNlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQWRkcmVzc0Jvb2snLCBmdW5jdGlvbigpXG57XG5cdHJldHVybiBmdW5jdGlvbiBBZGRyZXNzQm9vayhkYXRhKSB7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXG5cdFx0XHRkaXNwbGF5TmFtZTogJycsXG5cdFx0XHRjb250YWN0czogW10sXG5cdFx0XHRncm91cHM6IGRhdGEuZGF0YS5wcm9wcy5ncm91cHMsXG5cblx0XHRcdGdldENvbnRhY3Q6IGZ1bmN0aW9uKHVpZCkge1xuXHRcdFx0XHRmb3IodmFyIGkgaW4gdGhpcy5jb250YWN0cykge1xuXHRcdFx0XHRcdGlmKHRoaXMuY29udGFjdHNbaV0udWlkKCkgPT09IHVpZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuY29udGFjdHNbaV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXG5cdFx0XHRzaGFyZWRXaXRoOiB7XG5cdFx0XHRcdHVzZXJzOiBbXSxcblx0XHRcdFx0Z3JvdXBzOiBbXVxuXHRcdFx0fVxuXG5cdFx0fSk7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywgZGF0YSk7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXHRcdFx0b3duZXI6IGRhdGEudXJsLnNwbGl0KCcvJykuc2xpY2UoLTMsIC0yKVswXVxuXHRcdH0pO1xuXG5cdFx0dmFyIHNoYXJlcyA9IHRoaXMuZGF0YS5wcm9wcy5pbnZpdGU7XG5cdFx0aWYgKHR5cGVvZiBzaGFyZXMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHNoYXJlcy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHR2YXIgaHJlZiA9IHNoYXJlc1tqXS5ocmVmO1xuXHRcdFx0XHRpZiAoaHJlZi5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgYWNjZXNzID0gc2hhcmVzW2pdLmFjY2Vzcztcblx0XHRcdFx0aWYgKGFjY2Vzcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciByZWFkV3JpdGUgPSAodHlwZW9mIGFjY2Vzcy5yZWFkV3JpdGUgIT09ICd1bmRlZmluZWQnKTtcblxuXHRcdFx0XHRpZiAoaHJlZi5zdGFydHNXaXRoKCdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nKSkge1xuXHRcdFx0XHRcdHRoaXMuc2hhcmVkV2l0aC51c2Vycy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiBocmVmLnN1YnN0cigyNyksXG5cdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogaHJlZi5zdWJzdHIoMjcpLFxuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHJlYWRXcml0ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGhyZWYuc3RhcnRzV2l0aCgncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLycpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaGFyZWRXaXRoLmdyb3Vwcy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiBocmVmLnN1YnN0cigyOCksXG5cdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogaHJlZi5zdWJzdHIoMjgpLFxuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHJlYWRXcml0ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly92YXIgb3duZXIgPSB0aGlzLmRhdGEucHJvcHMub3duZXI7XG5cdFx0Ly9pZiAodHlwZW9mIG93bmVyICE9PSAndW5kZWZpbmVkJyAmJiBvd25lci5sZW5ndGggIT09IDApIHtcblx0XHQvL1x0b3duZXIgPSBvd25lci50cmltKCk7XG5cdFx0Ly9cdGlmIChvd25lci5zdGFydHNXaXRoKCcvcmVtb3RlLnBocC9kYXYvcHJpbmNpcGFscy91c2Vycy8nKSkge1xuXHRcdC8vXHRcdHRoaXMuX3Byb3BlcnRpZXMub3duZXIgPSBvd25lci5zdWJzdHIoMzMpO1xuXHRcdC8vXHR9XG5cdFx0Ly99XG5cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5mYWN0b3J5KCdDb250YWN0JywgZnVuY3Rpb24oJGZpbHRlcikge1xuXHRyZXR1cm4gZnVuY3Rpb24gQ29udGFjdChhZGRyZXNzQm9vaywgdkNhcmQpIHtcblx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLCB7XG5cblx0XHRcdGRhdGE6IHt9LFxuXHRcdFx0cHJvcHM6IHt9LFxuXG5cdFx0XHRhZGRyZXNzQm9va0lkOiBhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSxcblxuXHRcdFx0dWlkOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnNldFByb3BlcnR5KCd1aWQnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0UHJvcGVydHkoJ3VpZCcpLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRkaXNwbGF5TmFtZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZ1bGxOYW1lKCkgfHwgdGhpcy5vcmcoKSB8fCAnJztcblx0XHRcdH0sXG5cblx0XHRcdGZ1bGxOYW1lOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ2ZuJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gbW9kZWwuZ2V0UHJvcGVydHkoJ2ZuJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJvcGVydHkgPSBtb2RlbC5nZXRQcm9wZXJ0eSgnbicpO1xuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuam9pbigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHR0aXRsZTogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCd0aXRsZScsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ3RpdGxlJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdG9yZzogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnb3JnJyk7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHR2YXIgdmFsID0gdmFsdWU7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0aWYocHJvcGVydHkgJiYgQXJyYXkuaXNBcnJheShwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0XHRcdHZhbCA9IHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdFx0dmFsWzBdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCdvcmcnLCB7IHZhbHVlOiB2YWwgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWVbMF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRlbWFpbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdlbWFpbCcpO1xuXHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRwaG90bzogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdC8vIHNwbGl0cyBpbWFnZSBkYXRhIGludG8gXCJkYXRhOmltYWdlL2pwZWdcIiBhbmQgYmFzZSA2NCBlbmNvZGVkIGltYWdlXG5cdFx0XHRcdFx0dmFyIGltYWdlRGF0YSA9IHZhbHVlLnNwbGl0KCc7YmFzZTY0LCcpO1xuXHRcdFx0XHRcdHZhciBpbWFnZVR5cGUgPSBpbWFnZURhdGFbMF0uc2xpY2UoJ2RhdGE6Jy5sZW5ndGgpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3Bob3RvJywgeyB2YWx1ZTogaW1hZ2VEYXRhWzFdLCBtZXRhOiB7dHlwZTogW2ltYWdlVHlwZV19IH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ3Bob3RvJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHZhciB0eXBlID0gcHJvcGVydHkubWV0YS50eXBlO1xuXHRcdFx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNBcnJheSh0eXBlKSkge1xuXHRcdFx0XHRcdFx0XHR0eXBlID0gdHlwZVswXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICghdHlwZS5zdGFydHNXaXRoKCdpbWFnZS8nKSkge1xuXHRcdFx0XHRcdFx0XHR0eXBlID0gJ2ltYWdlLycgKyB0eXBlLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gJ2RhdGE6JyArIHR5cGUgKyAnO2Jhc2U2NCwnICsgcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRjYXRlZ29yaWVzOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdjYXRlZ29yaWVzJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkgJiYgcHJvcGVydHkudmFsdWUubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlLnNwbGl0KCcsJyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGdldFByb3BlcnR5OiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0XHRcdGlmICh0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMucHJvcHNbbmFtZV1bMF07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZFByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGRhdGEgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cdFx0XHRcdGlmKCF0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXSA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBpZHggPSB0aGlzLnByb3BzW25hbWVdLmxlbmd0aDtcblx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXVtpZHhdID0gZGF0YTtcblxuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0XHRyZXR1cm4gaWR4O1xuXHRcdFx0fSxcblx0XHRcdHNldFByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGlmKCF0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXSA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMucHJvcHNbbmFtZV1bMF0gPSBkYXRhO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlUHJvcGVydHk6IGZ1bmN0aW9uIChuYW1lLCBwcm9wKSB7XG5cdFx0XHRcdGFuZ3VsYXIuY29weShfLndpdGhvdXQodGhpcy5wcm9wc1tuYW1lXSwgcHJvcCksIHRoaXMucHJvcHNbbmFtZV0pO1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0RVRhZzogZnVuY3Rpb24oZXRhZykge1xuXHRcdFx0XHR0aGlzLmRhdGEuZXRhZyA9IGV0YWc7XG5cdFx0XHR9LFxuXHRcdFx0c2V0VXJsOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgdWlkKSB7XG5cdFx0XHRcdHRoaXMuZGF0YS51cmwgPSBhZGRyZXNzQm9vay51cmwgKyB1aWQgKyAnLnZjZic7XG5cdFx0XHR9LFxuXG5cdFx0XHRzeW5jVkNhcmQ6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0fSxcblxuXHRcdFx0bWF0Y2hlczogZnVuY3Rpb24ocGF0dGVybikge1xuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChwYXR0ZXJuKSB8fCBwYXR0ZXJuLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBtb2RlbCA9IHRoaXM7XG5cdFx0XHRcdHZhciBtYXRjaGluZ1Byb3BzID0gWydmbicsICd0aXRsZScsICdvcmcnLCAnZW1haWwnLCAnbmlja25hbWUnLCAnbm90ZScsICd1cmwnLCAnY2xvdWQnLCAnYWRyJywgJ2ltcHAnLCAndGVsJ10uZmlsdGVyKGZ1bmN0aW9uIChwcm9wTmFtZSkge1xuXHRcdFx0XHRcdGlmIChtb2RlbC5wcm9wc1twcm9wTmFtZV0pIHtcblx0XHRcdFx0XHRcdHJldHVybiBtb2RlbC5wcm9wc1twcm9wTmFtZV0uZmlsdGVyKGZ1bmN0aW9uIChwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoIXByb3BlcnR5LnZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlmIChfLmlzU3RyaW5nKHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YocGF0dGVybi50b0xvd2VyQ2FzZSgpKSAhPT0gLTE7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKF8uaXNBcnJheShwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuZmlsdGVyKGZ1bmN0aW9uKHYpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB2LnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpICE9PSAtMTtcblx0XHRcdFx0XHRcdFx0XHR9KS5sZW5ndGggPiAwO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH0pLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiBtYXRjaGluZ1Byb3BzLmxlbmd0aCA+IDA7XG5cdFx0XHR9XG5cblx0XHR9KTtcblxuXHRcdGlmKGFuZ3VsYXIuaXNEZWZpbmVkKHZDYXJkKSkge1xuXHRcdFx0YW5ndWxhci5leHRlbmQodGhpcy5kYXRhLCB2Q2FyZCk7XG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLnByb3BzLCAkZmlsdGVyKCd2Q2FyZDJKU09OJykodGhpcy5kYXRhLmFkZHJlc3NEYXRhKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMucHJvcHMsIHtcblx0XHRcdFx0dmVyc2lvbjogW3t2YWx1ZTogJzMuMCd9XSxcblx0XHRcdFx0Zm46IFt7dmFsdWU6ICcnfV1cblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdH1cblxuXHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnKTtcblx0XHRpZighcHJvcGVydHkpIHtcblx0XHRcdHRoaXMuY2F0ZWdvcmllcygnJyk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZhY3RvcnkoJ0FkZHJlc3NCb29rU2VydmljZScsIGZ1bmN0aW9uKERhdkNsaWVudCwgRGF2U2VydmljZSwgU2V0dGluZ3NTZXJ2aWNlLCBBZGRyZXNzQm9vaywgJHEpIHtcblxuXHR2YXIgYWRkcmVzc0Jvb2tzID0gW107XG5cdHZhciBsb2FkUHJvbWlzZSA9IHVuZGVmaW5lZDtcblxuXHR2YXIgbG9hZEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChhZGRyZXNzQm9va3MubGVuZ3RoID4gMCkge1xuXHRcdFx0cmV0dXJuICRxLndoZW4oYWRkcmVzc0Jvb2tzKTtcblx0XHR9XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobG9hZFByb21pc2UpKSB7XG5cdFx0XHRsb2FkUHJvbWlzZSA9IERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRhZGRyZXNzQm9va3MgPSBhY2NvdW50LmFkZHJlc3NCb29rcy5tYXAoZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEFkZHJlc3NCb29rKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGxvYWRQcm9taXNlO1xuXHR9O1xuXG5cdHJldHVybiB7XG5cdFx0Z2V0QWxsOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBsb2FkQWxsKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcztcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRnZXRHcm91cHM6IGZ1bmN0aW9uICgpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHJldHVybiBhZGRyZXNzQm9va3MubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuZ3JvdXBzO1xuXHRcdFx0XHR9KS5yZWR1Y2UoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRcdHJldHVybiBhLmNvbmNhdChiKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Z2V0RGVmYXVsdEFkZHJlc3NCb29rOiBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBhZGRyZXNzQm9va3NbMF07XG5cdFx0fSxcblxuXHRcdGdldEFkZHJlc3NCb29rOiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuZ2V0QWRkcmVzc0Jvb2soe2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdGFkZHJlc3NCb29rID0gbmV3IEFkZHJlc3NCb29rKHtcblx0XHRcdFx0XHRcdHVybDogYWRkcmVzc0Jvb2tbMF0uaHJlZixcblx0XHRcdFx0XHRcdGRhdGE6IGFkZHJlc3NCb29rWzBdXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2suZGlzcGxheU5hbWUgPSBkaXNwbGF5TmFtZTtcblx0XHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2s7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGNyZWF0ZTogZnVuY3Rpb24oZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybiBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oYWNjb3VudCkge1xuXHRcdFx0XHRyZXR1cm4gRGF2Q2xpZW50LmNyZWF0ZUFkZHJlc3NCb29rKHtkaXNwbGF5TmFtZTpkaXNwbGF5TmFtZSwgdXJsOmFjY291bnQuaG9tZVVybH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGRlbGV0ZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdHJldHVybiBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuZGVsZXRlQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0dmFyIGluZGV4ID0gYWRkcmVzc0Jvb2tzLmluZGV4T2YoYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHRcdGFkZHJlc3NCb29rcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRyZW5hbWU6IGZ1bmN0aW9uKGFkZHJlc3NCb29rLCBkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQucmVuYW1lQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2ssIHtkaXNwbGF5TmFtZTpkaXNwbGF5TmFtZSwgdXJsOmFjY291bnQuaG9tZVVybH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGdldDogZnVuY3Rpb24oZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHJldHVybiBhZGRyZXNzQm9va3MuZmlsdGVyKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuZGlzcGxheU5hbWUgPT09IGRpc3BsYXlOYW1lO1xuXHRcdFx0XHR9KVswXTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRzeW5jOiBmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0cmV0dXJuIERhdkNsaWVudC5zeW5jQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spO1xuXHRcdH0sXG5cblx0XHRzaGFyZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIHNoYXJlVHlwZSwgc2hhcmVXaXRoLCB3cml0YWJsZSwgZXhpc3RpbmdTaGFyZSkge1xuXHRcdFx0dmFyIHhtbERvYyA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZURvY3VtZW50KCcnLCAnJywgbnVsbCk7XG5cdFx0XHR2YXIgb1NoYXJlID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286c2hhcmUnKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOmQnLCAnREFWOicpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6bycsICdodHRwOi8vb3duY2xvdWQub3JnL25zJyk7XG5cdFx0XHR4bWxEb2MuYXBwZW5kQ2hpbGQob1NoYXJlKTtcblxuXHRcdFx0dmFyIG9TZXQgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzZXQnKTtcblx0XHRcdG9TaGFyZS5hcHBlbmRDaGlsZChvU2V0KTtcblxuXHRcdFx0dmFyIGRIcmVmID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ2Q6aHJlZicpO1xuXHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL3VzZXJzLyc7XG5cdFx0XHR9IGVsc2UgaWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCkge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy9ncm91cHMvJztcblx0XHRcdH1cblx0XHRcdGRIcmVmLnRleHRDb250ZW50ICs9IHNoYXJlV2l0aDtcblx0XHRcdG9TZXQuYXBwZW5kQ2hpbGQoZEhyZWYpO1xuXG5cdFx0XHR2YXIgb1N1bW1hcnkgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzdW1tYXJ5Jyk7XG5cdFx0XHRvU3VtbWFyeS50ZXh0Q29udGVudCA9IHQoJ2NvbnRhY3RzJywgJ3thZGRyZXNzYm9va30gc2hhcmVkIGJ5IHtvd25lcn0nLCB7XG5cdFx0XHRcdGFkZHJlc3Nib29rOiBhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSxcblx0XHRcdFx0b3duZXI6IGFkZHJlc3NCb29rLm93bmVyXG5cdFx0XHR9KTtcblx0XHRcdG9TZXQuYXBwZW5kQ2hpbGQob1N1bW1hcnkpO1xuXG5cdFx0XHRpZiAod3JpdGFibGUpIHtcblx0XHRcdFx0dmFyIG9SVyA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnJlYWQtd3JpdGUnKTtcblx0XHRcdFx0b1NldC5hcHBlbmRDaGlsZChvUlcpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgYm9keSA9IG9TaGFyZS5vdXRlckhUTUw7XG5cblx0XHRcdHJldHVybiBEYXZDbGllbnQueGhyLnNlbmQoXG5cdFx0XHRcdGRhdi5yZXF1ZXN0LmJhc2ljKHttZXRob2Q6ICdQT1NUJywgZGF0YTogYm9keX0pLFxuXHRcdFx0XHRhZGRyZXNzQm9vay51cmxcblx0XHRcdCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDApIHtcblx0XHRcdFx0XHRpZiAoIWV4aXN0aW5nU2hhcmUpIHtcblx0XHRcdFx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHR3cml0YWJsZTogd3JpdGFibGVcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCkge1xuXHRcdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLmdyb3Vwcy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRpZDogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdGRpc3BsYXluYW1lOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0d3JpdGFibGU6IHdyaXRhYmxlXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9LFxuXG5cdFx0dW5zaGFyZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIHNoYXJlVHlwZSwgc2hhcmVXaXRoKSB7XG5cdFx0XHR2YXIgeG1sRG9jID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlRG9jdW1lbnQoJycsICcnLCBudWxsKTtcblx0XHRcdHZhciBvU2hhcmUgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzaGFyZScpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6ZCcsICdEQVY6Jyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpvJywgJ2h0dHA6Ly9vd25jbG91ZC5vcmcvbnMnKTtcblx0XHRcdHhtbERvYy5hcHBlbmRDaGlsZChvU2hhcmUpO1xuXG5cdFx0XHR2YXIgb1JlbW92ZSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnJlbW92ZScpO1xuXHRcdFx0b1NoYXJlLmFwcGVuZENoaWxkKG9SZW1vdmUpO1xuXG5cdFx0XHR2YXIgZEhyZWYgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnZDpocmVmJyk7XG5cdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJztcblx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nO1xuXHRcdFx0fVxuXHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgKz0gc2hhcmVXaXRoO1xuXHRcdFx0b1JlbW92ZS5hcHBlbmRDaGlsZChkSHJlZik7XG5cdFx0XHR2YXIgYm9keSA9IG9TaGFyZS5vdXRlckhUTUw7XG5cblxuXHRcdFx0cmV0dXJuIERhdkNsaWVudC54aHIuc2VuZChcblx0XHRcdFx0ZGF2LnJlcXVlc3QuYmFzaWMoe21ldGhvZDogJ1BPU1QnLCBkYXRhOiBib2R5fSksXG5cdFx0XHRcdGFkZHJlc3NCb29rLnVybFxuXHRcdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwMCkge1xuXHRcdFx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRcdFx0YWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2VycyA9IGFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnMuZmlsdGVyKGZ1bmN0aW9uKHVzZXIpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVzZXIuaWQgIT09IHNoYXJlV2l0aDtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLmdyb3VwcyA9IGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzLmZpbHRlcihmdW5jdGlvbihncm91cHMpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGdyb3Vwcy5pZCAhPT0gc2hhcmVXaXRoO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vdG9kbyAtIHJlbW92ZSBlbnRyeSBmcm9tIGFkZHJlc3Nib29rIG9iamVjdFxuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHR9XG5cblxuXHR9O1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgnQ29udGFjdFNlcnZpY2UnLCBmdW5jdGlvbihEYXZDbGllbnQsIEFkZHJlc3NCb29rU2VydmljZSwgQ29udGFjdCwgJHEsIENhY2hlRmFjdG9yeSwgdXVpZDQpIHtcblxuXHR2YXIgY2FjaGVGaWxsZWQgPSBmYWxzZTtcblxuXHR2YXIgY29udGFjdHMgPSBDYWNoZUZhY3RvcnkoJ2NvbnRhY3RzJyk7XG5cblx0dmFyIG9ic2VydmVyQ2FsbGJhY2tzID0gW107XG5cblx0dmFyIGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXG5cdHRoaXMucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRvYnNlcnZlckNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcblx0fTtcblxuXHR2YXIgbm90aWZ5T2JzZXJ2ZXJzID0gZnVuY3Rpb24oZXZlbnROYW1lLCB1aWQpIHtcblx0XHR2YXIgZXYgPSB7XG5cdFx0XHRldmVudDogZXZlbnROYW1lLFxuXHRcdFx0dWlkOiB1aWQsXG5cdFx0XHRjb250YWN0czogY29udGFjdHMudmFsdWVzKClcblx0XHR9O1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChvYnNlcnZlckNhbGxiYWNrcywgZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGV2KTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmZpbGxDYWNoZSA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmIChfLmlzVW5kZWZpbmVkKGxvYWRQcm9taXNlKSkge1xuXHRcdFx0bG9hZFByb21pc2UgPSBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWxsKCkudGhlbihmdW5jdGlvbiAoZW5hYmxlZEFkZHJlc3NCb29rcykge1xuXHRcdFx0XHR2YXIgcHJvbWlzZXMgPSBbXTtcblx0XHRcdFx0ZW5hYmxlZEFkZHJlc3NCb29rcy5mb3JFYWNoKGZ1bmN0aW9uIChhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdHByb21pc2VzLnB1c2goXG5cdFx0XHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2Uuc3luYyhhZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbiAoYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRcdFx0Zm9yICh2YXIgaSBpbiBhZGRyZXNzQm9vay5vYmplY3RzKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGFkZHJlc3NCb29rLm9iamVjdHNbaV0uYWRkcmVzc0RhdGEpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHZhciBjb250YWN0ID0gbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2ssIGFkZHJlc3NCb29rLm9iamVjdHNbaV0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGFjdHMucHV0KGNvbnRhY3QudWlkKCksIGNvbnRhY3QpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBjdXN0b20gY29uc29sZVxuXHRcdFx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coJ0ludmFsaWQgY29udGFjdCByZWNlaXZlZDogJyArIGFkZHJlc3NCb29rLm9iamVjdHNbaV0udXJsKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiAkcS5hbGwocHJvbWlzZXMpLnRoZW4oZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGNhY2hlRmlsbGVkID0gdHJ1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIGxvYWRQcm9taXNlO1xuXHR9O1xuXG5cdHRoaXMuZ2V0QWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYoY2FjaGVGaWxsZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5maWxsQ2FjaGUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udGFjdHMudmFsdWVzKCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuICRxLndoZW4oY29udGFjdHMudmFsdWVzKCkpO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLmdldEdyb3VwcyA9IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3RzKSB7XG5cdFx0XHRyZXR1cm4gXy51bmlxKGNvbnRhY3RzLm1hcChmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdFx0XHRyZXR1cm4gZWxlbWVudC5jYXRlZ29yaWVzKCk7XG5cdFx0XHR9KS5yZWR1Y2UoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRyZXR1cm4gYS5jb25jYXQoYik7XG5cdFx0XHR9LCBbXSkuc29ydCgpLCB0cnVlKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmdldEJ5SWQgPSBmdW5jdGlvbih1aWQpIHtcblx0XHRpZihjYWNoZUZpbGxlZCA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGxDYWNoZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb250YWN0cy5nZXQodWlkKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihjb250YWN0cy5nZXQodWlkKSk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuY3JlYXRlID0gZnVuY3Rpb24obmV3Q29udGFjdCwgYWRkcmVzc0Jvb2ssIHVpZCkge1xuXHRcdGFkZHJlc3NCb29rID0gYWRkcmVzc0Jvb2sgfHwgQWRkcmVzc0Jvb2tTZXJ2aWNlLmdldERlZmF1bHRBZGRyZXNzQm9vaygpO1xuXHRcdG5ld0NvbnRhY3QgPSBuZXdDb250YWN0IHx8IG5ldyBDb250YWN0KGFkZHJlc3NCb29rKTtcblx0XHR2YXIgbmV3VWlkID0gJyc7XG5cdFx0aWYodXVpZDQudmFsaWRhdGUodWlkKSkge1xuXHRcdFx0bmV3VWlkID0gdWlkO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRuZXdVaWQgPSB1dWlkNC5nZW5lcmF0ZSgpO1xuXHRcdH1cblx0XHRuZXdDb250YWN0LnVpZChuZXdVaWQpO1xuXHRcdG5ld0NvbnRhY3Quc2V0VXJsKGFkZHJlc3NCb29rLCBuZXdVaWQpO1xuXHRcdG5ld0NvbnRhY3QuYWRkcmVzc0Jvb2tJZCA9IGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lO1xuXG5cdFx0cmV0dXJuIERhdkNsaWVudC5jcmVhdGVDYXJkKFxuXHRcdFx0YWRkcmVzc0Jvb2ssXG5cdFx0XHR7XG5cdFx0XHRcdGRhdGE6IG5ld0NvbnRhY3QuZGF0YS5hZGRyZXNzRGF0YSxcblx0XHRcdFx0ZmlsZW5hbWU6IG5ld1VpZCArICcudmNmJ1xuXHRcdFx0fVxuXHRcdCkudGhlbihmdW5jdGlvbih4aHIpIHtcblx0XHRcdG5ld0NvbnRhY3Quc2V0RVRhZyh4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0VUYWcnKSk7XG5cdFx0XHRjb250YWN0cy5wdXQobmV3VWlkLCBuZXdDb250YWN0KTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnY3JlYXRlJywgbmV3VWlkKTtcblx0XHRcdHJldHVybiBuZXdDb250YWN0O1xuXHRcdH0pLmNhdGNoKGZ1bmN0aW9uKGUpIHtcblx0XHRcdGNvbnNvbGUubG9nKFwiQ291bGRuJ3QgY3JlYXRlXCIsIGUpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuaW1wb3J0ID0gZnVuY3Rpb24oZGF0YSwgdHlwZSwgYWRkcmVzc0Jvb2ssIHByb2dyZXNzQ2FsbGJhY2spIHtcblx0XHRhZGRyZXNzQm9vayA9IGFkZHJlc3NCb29rIHx8IEFkZHJlc3NCb29rU2VydmljZS5nZXREZWZhdWx0QWRkcmVzc0Jvb2soKTtcblxuXHRcdHZhciByZWdleHAgPSAvQkVHSU46VkNBUkRbXFxzXFxTXSo/RU5EOlZDQVJEL21naTtcblx0XHR2YXIgc2luZ2xlVkNhcmRzID0gZGF0YS5tYXRjaChyZWdleHApO1xuXG5cdFx0aWYgKCFzaW5nbGVWQ2FyZHMpIHtcblx0XHRcdE9DLk5vdGlmaWNhdGlvbi5zaG93VGVtcG9yYXJ5KHQoJ2NvbnRhY3RzJywgJ05vIGNvbnRhY3RzIGluIGZpbGUuIE9ubHkgVkNhcmQgZmlsZXMgYXJlIGFsbG93ZWQuJykpO1xuXHRcdFx0aWYgKHByb2dyZXNzQ2FsbGJhY2spIHtcblx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjaygxKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIG51bSA9IDE7XG5cdFx0Zm9yKHZhciBpIGluIHNpbmdsZVZDYXJkcykge1xuXHRcdFx0dmFyIG5ld0NvbnRhY3QgPSBuZXcgQ29udGFjdChhZGRyZXNzQm9vaywge2FkZHJlc3NEYXRhOiBzaW5nbGVWQ2FyZHNbaV19KTtcblx0XHRcdHRoaXMuY3JlYXRlKG5ld0NvbnRhY3QsIGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHQvLyBVcGRhdGUgdGhlIHByb2dyZXNzIGluZGljYXRvclxuXHRcdFx0XHRpZiAocHJvZ3Jlc3NDYWxsYmFjaykgcHJvZ3Jlc3NDYWxsYmFjayhudW0vc2luZ2xlVkNhcmRzLmxlbmd0aCk7XG5cdFx0XHRcdG51bSsrO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMubW92ZUNvbnRhY3QgPSBmdW5jdGlvbiAoY29udGFjdCwgYWRkcmVzc2Jvb2spIHtcblx0XHRpZiAoY29udGFjdC5hZGRyZXNzQm9va0lkID09PSBhZGRyZXNzYm9vay5kaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250YWN0LnN5bmNWQ2FyZCgpO1xuXHRcdHZhciBjbG9uZSA9IGFuZ3VsYXIuY29weShjb250YWN0KTtcblx0XHR2YXIgdWlkID0gY29udGFjdC51aWQoKTtcblxuXHRcdC8vIGRlbGV0ZSB0aGUgb2xkIG9uZSBiZWZvcmUgdG8gYXZvaWQgY29uZmxpY3Rcblx0XHR0aGlzLmRlbGV0ZShjb250YWN0KTtcblxuXHRcdC8vIGNyZWF0ZSB0aGUgY29udGFjdCBpbiB0aGUgbmV3IHRhcmdldCBhZGRyZXNzYm9va1xuXHRcdHRoaXMuY3JlYXRlKGNsb25lLCBhZGRyZXNzYm9vaywgdWlkKTtcblx0fTtcblxuXHR0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRjb250YWN0LnN5bmNWQ2FyZCgpO1xuXG5cdFx0Ly8gdXBkYXRlIGNvbnRhY3Qgb24gc2VydmVyXG5cdFx0cmV0dXJuIERhdkNsaWVudC51cGRhdGVDYXJkKGNvbnRhY3QuZGF0YSwge2pzb246IHRydWV9KS50aGVuKGZ1bmN0aW9uKHhocikge1xuXHRcdFx0dmFyIG5ld0V0YWcgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0VUYWcnKTtcblx0XHRcdGNvbnRhY3Quc2V0RVRhZyhuZXdFdGFnKTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygndXBkYXRlJywgY29udGFjdC51aWQoKSk7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5kZWxldGUgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0Ly8gZGVsZXRlIGNvbnRhY3QgZnJvbSBzZXJ2ZXJcblx0XHRyZXR1cm4gRGF2Q2xpZW50LmRlbGV0ZUNhcmQoY29udGFjdC5kYXRhKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGFjdHMucmVtb3ZlKGNvbnRhY3QudWlkKCkpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdkZWxldGUnLCBjb250YWN0LnVpZCgpKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZDbGllbnQnLCBmdW5jdGlvbigpIHtcblx0dmFyIHhociA9IG5ldyBkYXYudHJhbnNwb3J0LkJhc2ljKFxuXHRcdG5ldyBkYXYuQ3JlZGVudGlhbHMoKVxuXHQpO1xuXHRyZXR1cm4gbmV3IGRhdi5DbGllbnQoeGhyKTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50KSB7XG5cdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWNjb3VudCh7XG5cdFx0c2VydmVyOiBPQy5saW5rVG9SZW1vdGUoJ2Rhdi9hZGRyZXNzYm9va3MnKSxcblx0XHRhY2NvdW50VHlwZTogJ2NhcmRkYXYnLFxuXHRcdHVzZVByb3ZpZGVkUGF0aDogdHJ1ZVxuXHR9KTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZWFyY2hTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdHZhciBzZWFyY2hUZXJtID0gJyc7XG5cblx0dmFyIG9ic2VydmVyQ2FsbGJhY2tzID0gW107XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUpIHtcblx0XHR2YXIgZXYgPSB7XG5cdFx0XHRldmVudDpldmVudE5hbWUsXG5cdFx0XHRzZWFyY2hUZXJtOnNlYXJjaFRlcm1cblx0XHR9O1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChvYnNlcnZlckNhbGxiYWNrcywgZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGV2KTtcblx0XHR9KTtcblx0fTtcblxuXHR2YXIgU2VhcmNoUHJveHkgPSB7XG5cdFx0YXR0YWNoOiBmdW5jdGlvbihzZWFyY2gpIHtcblx0XHRcdHNlYXJjaC5zZXRGaWx0ZXIoJ2NvbnRhY3RzJywgdGhpcy5maWx0ZXJQcm94eSk7XG5cdFx0fSxcblx0XHRmaWx0ZXJQcm94eTogZnVuY3Rpb24ocXVlcnkpIHtcblx0XHRcdHNlYXJjaFRlcm0gPSBxdWVyeTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnY2hhbmdlU2VhcmNoJyk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0U2VhcmNoVGVybSA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZWFyY2hUZXJtO1xuXHR9O1xuXG5cdHRoaXMuY2xlYW5TZWFyY2ggPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoJCgnLnNlYXJjaGJveCcpKSkge1xuXHRcdFx0JCgnLnNlYXJjaGJveCcpWzBdLnJlc2V0KCk7XG5cdFx0fVxuXHRcdHNlYXJjaFRlcm0gPSAnJztcblx0fTtcblxuXHRpZiAoIV8uaXNVbmRlZmluZWQoT0MuUGx1Z2lucykpIHtcblx0XHRPQy5QbHVnaW5zLnJlZ2lzdGVyKCdPQ0EuU2VhcmNoJywgU2VhcmNoUHJveHkpO1xuXHRcdGlmICghXy5pc1VuZGVmaW5lZChPQ0EuU2VhcmNoKSkge1xuXHRcdFx0T0MuU2VhcmNoID0gbmV3IE9DQS5TZWFyY2goJCgnI3NlYXJjaGJveCcpLCAkKCcjc2VhcmNocmVzdWx0cycpKTtcblx0XHRcdCQoJyNzZWFyY2hib3gnKS5zaG93KCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFfLmlzVW5kZWZpbmVkKCQoJy5zZWFyY2hib3gnKSkpIHtcblx0XHQkKCcuc2VhcmNoYm94JylbMF0uYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRpZihlLmtleUNvZGUgPT09IDEzKSB7XG5cdFx0XHRcdG5vdGlmeU9ic2VydmVycygnc3VibWl0U2VhcmNoJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZXR0aW5nc1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0dmFyIHNldHRpbmdzID0ge1xuXHRcdGFkZHJlc3NCb29rczogW1xuXHRcdFx0J3Rlc3RBZGRyJ1xuXHRcdF1cblx0fTtcblxuXHR0aGlzLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRzZXR0aW5nc1trZXldID0gdmFsdWU7XG5cdH07XG5cblx0dGhpcy5nZXQgPSBmdW5jdGlvbihrZXkpIHtcblx0XHRyZXR1cm4gc2V0dGluZ3Nba2V5XTtcblx0fTtcblxuXHR0aGlzLmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZXR0aW5ncztcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCd2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdC8qKlxuXHQgKiBtYXAgdkNhcmQgYXR0cmlidXRlcyB0byBpbnRlcm5hbCBhdHRyaWJ1dGVzXG5cdCAqXG5cdCAqIHByb3BOYW1lOiB7XG5cdCAqIFx0XHRtdWx0aXBsZTogW0Jvb2xlYW5dLCAvLyBpcyB0aGlzIHByb3AgYWxsb3dlZCBtb3JlIHRoYW4gb25jZT8gKGRlZmF1bHQgPSBmYWxzZSlcblx0ICogXHRcdHJlYWRhYmxlTmFtZTogW1N0cmluZ10sIC8vIGludGVybmF0aW9uYWxpemVkIHJlYWRhYmxlIG5hbWUgb2YgcHJvcFxuXHQgKiBcdFx0dGVtcGxhdGU6IFtTdHJpbmddLCAvLyB0ZW1wbGF0ZSBuYW1lIGZvdW5kIGluIC90ZW1wbGF0ZXMvZGV0YWlsSXRlbXNcblx0ICogXHRcdFsuLi5dIC8vIG9wdGlvbmFsIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gd2hpY2ggbWlnaHQgZ2V0IHVzZWQgYnkgdGhlIHRlbXBsYXRlXG5cdCAqIH1cblx0ICovXG5cdHRoaXMudkNhcmRNZXRhID0ge1xuXHRcdG5pY2tuYW1lOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ05pY2tuYW1lJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnXG5cdFx0fSxcblx0XHRuOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0RldGFpbGVkIG5hbWUnKSxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJycsICcnLCAnJywgJycsICcnXVxuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlOiAnbidcblx0XHR9LFxuXHRcdG5vdGU6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnTm90ZXMnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dGFyZWEnXG5cdFx0fSxcblx0XHR1cmw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdXZWJzaXRlJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3VybCdcblx0XHR9LFxuXHRcdGNsb3VkOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRmVkZXJhdGVkIENsb3VkIElEJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cdFx0fSxcblx0XHRhZHI6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdBZGRyZXNzJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2FkcicsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnLCAnJywgJycsICcnLCAnJywgJycsICcnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0Y2F0ZWdvcmllczoge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdHcm91cHMnKSxcblx0XHRcdHRlbXBsYXRlOiAnZ3JvdXBzJ1xuXHRcdH0sXG5cdFx0YmRheToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdCaXJ0aGRheScpLFxuXHRcdFx0dGVtcGxhdGU6ICdkYXRlJ1xuXHRcdH0sXG5cdFx0ZW1haWw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdFbWFpbCcpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTonJyxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0aW1wcDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0luc3RhbnQgbWVzc2FnaW5nJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHRlbDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ1Bob25lJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RlbCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUsVk9JQ0UnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUsVk9JQ0UnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLLFZPSUNFJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnQ0VMTCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ01vYmlsZScpfSxcblx0XHRcdFx0e2lkOiAnRkFYJywgbmFtZTogdCgnY29udGFjdHMnLCAnRmF4Jyl9LFxuXHRcdFx0XHR7aWQ6ICdIT01FLEZBWCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZheCBob21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLLEZBWCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZheCB3b3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdQQUdFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1BhZ2VyJyl9LFxuXHRcdFx0XHR7aWQ6ICdWT0lDRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1ZvaWNlJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHQnWC1TT0NJQUxQUk9GSUxFJzoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ1NvY2lhbCBuZXR3b3JrJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydmYWNlYm9vayddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnRkFDRUJPT0snLCBuYW1lOiAnRmFjZWJvb2snfSxcblx0XHRcdFx0e2lkOiAnVFdJVFRFUicsIG5hbWU6ICdUd2l0dGVyJ31cblx0XHRcdF1cblxuXHRcdH1cblx0fTtcblxuXHR0aGlzLmZpZWxkT3JkZXIgPSBbXG5cdFx0J29yZycsXG5cdFx0J3RpdGxlJyxcblx0XHQndGVsJyxcblx0XHQnZW1haWwnLFxuXHRcdCdhZHInLFxuXHRcdCdpbXBwJyxcblx0XHQnbmljaycsXG5cdFx0J2JkYXknLFxuXHRcdCd1cmwnLFxuXHRcdCdYLVNPQ0lBTFBST0ZJTEUnLFxuXHRcdCdub3RlJyxcblx0XHQnY2F0ZWdvcmllcycsXG5cdFx0J3JvbGUnXG5cdF07XG5cblx0dGhpcy5maWVsZERlZmluaXRpb25zID0gW107XG5cdGZvciAodmFyIHByb3AgaW4gdGhpcy52Q2FyZE1ldGEpIHtcblx0XHR0aGlzLmZpZWxkRGVmaW5pdGlvbnMucHVzaCh7aWQ6IHByb3AsIG5hbWU6IHRoaXMudkNhcmRNZXRhW3Byb3BdLnJlYWRhYmxlTmFtZSwgbXVsdGlwbGU6ICEhdGhpcy52Q2FyZE1ldGFbcHJvcF0ubXVsdGlwbGV9KTtcblx0fVxuXG5cdHRoaXMuZmFsbGJhY2tNZXRhID0gZnVuY3Rpb24ocHJvcGVydHkpIHtcblx0XHRmdW5jdGlvbiBjYXBpdGFsaXplKHN0cmluZykgeyByZXR1cm4gc3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyaW5nLnNsaWNlKDEpOyB9XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6ICd1bmtub3duLScgKyBwcm9wZXJ0eSxcblx0XHRcdHJlYWRhYmxlTmFtZTogY2FwaXRhbGl6ZShwcm9wZXJ0eSksXG5cdFx0XHR0ZW1wbGF0ZTogJ2hpZGRlbicsXG5cdFx0XHRuZWNlc3NpdHk6ICdvcHRpb25hbCdcblx0XHR9O1xuXHR9O1xuXG5cdHRoaXMuZ2V0TWV0YSA9IGZ1bmN0aW9uKHByb3BlcnR5KSB7XG5cdFx0cmV0dXJuIHRoaXMudkNhcmRNZXRhW3Byb3BlcnR5XSB8fCB0aGlzLmZhbGxiYWNrTWV0YShwcm9wZXJ0eSk7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ0pTT04ydkNhcmQnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIHZDYXJkLmdlbmVyYXRlKGlucHV0KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2NvbnRhY3RDb2xvcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHQvLyBDaGVjayBpZiBjb3JlIGhhcyB0aGUgbmV3IGNvbG9yIGdlbmVyYXRvclxuXHRcdGlmKHR5cGVvZiBpbnB1dC50b0hzbCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dmFyIGhzbCA9IGlucHV0LnRvSHNsKCk7XG5cdFx0XHRyZXR1cm4gJ2hzbCgnK2hzbFswXSsnLCAnK2hzbFsxXSsnJSwgJytoc2xbMl0rJyUpJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gSWYgbm90LCB3ZSB1c2UgdGhlIG9sZCBvbmVcblx0XHRcdC8qIGdsb2JhbCBtZDUgKi9cblx0XHRcdHZhciBoYXNoID0gbWQ1KGlucHV0KS5zdWJzdHJpbmcoMCwgNCksXG5cdFx0XHRcdG1heFJhbmdlID0gcGFyc2VJbnQoJ2ZmZmYnLCAxNiksXG5cdFx0XHRcdGh1ZSA9IHBhcnNlSW50KGhhc2gsIDE2KSAvIG1heFJhbmdlICogMjU2O1xuXHRcdFx0cmV0dXJuICdoc2woJyArIGh1ZSArICcsIDkwJSwgNjUlKSc7XG5cdFx0fVxuXHR9O1xufSk7IiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2NvbnRhY3RHcm91cEZpbHRlcicsIGZ1bmN0aW9uKCkge1xuXHQndXNlIHN0cmljdCc7XG5cdHJldHVybiBmdW5jdGlvbiAoY29udGFjdHMsIGdyb3VwKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250YWN0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBjb250YWN0cztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBncm91cCA9PT0gJ3VuZGVmaW5lZCcgfHwgZ3JvdXAudG9Mb3dlckNhc2UoKSA9PT0gdCgnY29udGFjdHMnLCAnQWxsIGNvbnRhY3RzJykudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIGNvbnRhY3RzO1xuXHRcdH1cblx0XHR2YXIgZmlsdGVyID0gW107XG5cdFx0aWYgKGNvbnRhY3RzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgY29udGFjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGdyb3VwLnRvTG93ZXJDYXNlKCkgPT09IHQoJ2NvbnRhY3RzJywgJ05vdCBncm91cGVkJykudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0XHRcdGlmIChjb250YWN0c1tpXS5jYXRlZ29yaWVzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRmaWx0ZXIucHVzaChjb250YWN0c1tpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChjb250YWN0c1tpXS5jYXRlZ29yaWVzKCkuaW5kZXhPZihncm91cCkgPj0gMCkge1xuXHRcdFx0XHRcdFx0ZmlsdGVyLnB1c2goY29udGFjdHNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyLmxlbmd0aCA9PT0gMCA/IGNvbnRhY3RzIDogZmlsdGVyO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignZmllbGRGaWx0ZXInLCBmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24gKGZpZWxkcywgY29udGFjdCkge1xuXHRcdGlmICh0eXBlb2YgZmllbGRzID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGZpZWxkcztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBjb250YWN0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGZpZWxkcztcblx0XHR9XG5cdFx0dmFyIGZpbHRlciA9IFtdO1xuXHRcdGlmIChmaWVsZHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGZpZWxkc1tpXS5tdWx0aXBsZSApIHtcblx0XHRcdFx0XHRmaWx0ZXIucHVzaChmaWVsZHNbaV0pO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKGNvbnRhY3QuZ2V0UHJvcGVydHkoZmllbGRzW2ldLmlkKSkpIHtcblx0XHRcdFx0XHRmaWx0ZXIucHVzaChmaWVsZHNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXI7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdmaXJzdENoYXJhY3RlcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gaW5wdXQuY2hhckF0KDApO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignbG9jYWxlT3JkZXJCeScsIFtmdW5jdGlvbiAoKSB7XG5cdHJldHVybiBmdW5jdGlvbiAoYXJyYXksIHNvcnRQcmVkaWNhdGUsIHJldmVyc2VPcmRlcikge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpIHJldHVybiBhcnJheTtcblx0XHRpZiAoIXNvcnRQcmVkaWNhdGUpIHJldHVybiBhcnJheTtcblxuXHRcdHZhciBhcnJheUNvcHkgPSBbXTtcblx0XHRhbmd1bGFyLmZvckVhY2goYXJyYXksIGZ1bmN0aW9uIChpdGVtKSB7XG5cdFx0XHRhcnJheUNvcHkucHVzaChpdGVtKTtcblx0XHR9KTtcblxuXHRcdGFycmF5Q29weS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHR2YXIgdmFsdWVBID0gYVtzb3J0UHJlZGljYXRlXTtcblx0XHRcdGlmIChhbmd1bGFyLmlzRnVuY3Rpb24odmFsdWVBKSkge1xuXHRcdFx0XHR2YWx1ZUEgPSBhW3NvcnRQcmVkaWNhdGVdKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgdmFsdWVCID0gYltzb3J0UHJlZGljYXRlXTtcblx0XHRcdGlmIChhbmd1bGFyLmlzRnVuY3Rpb24odmFsdWVCKSkge1xuXHRcdFx0XHR2YWx1ZUIgPSBiW3NvcnRQcmVkaWNhdGVdKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhbmd1bGFyLmlzU3RyaW5nKHZhbHVlQSkpIHtcblx0XHRcdFx0cmV0dXJuICFyZXZlcnNlT3JkZXIgPyB2YWx1ZUEubG9jYWxlQ29tcGFyZSh2YWx1ZUIpIDogdmFsdWVCLmxvY2FsZUNvbXBhcmUodmFsdWVBKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFuZ3VsYXIuaXNOdW1iZXIodmFsdWVBKSB8fCBhbmd1bGFyLmlzQm9vbGVhbih2YWx1ZUEpKSB7XG5cdFx0XHRcdHJldHVybiAhcmV2ZXJzZU9yZGVyID8gdmFsdWVBIC0gdmFsdWVCIDogdmFsdWVCIC0gdmFsdWVBO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9KTtcblxuXHRcdHJldHVybiBhcnJheUNvcHk7XG5cdH07XG59XSk7XG5cbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCduZXdDb250YWN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiBpbnB1dCAhPT0gJycgPyBpbnB1dCA6IHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0Jyk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdvcmRlckRldGFpbEl0ZW1zJywgZnVuY3Rpb24odkNhcmRQcm9wZXJ0aWVzU2VydmljZSkge1xuXHQndXNlIHN0cmljdCc7XG5cdHJldHVybiBmdW5jdGlvbihpdGVtcywgZmllbGQsIHJldmVyc2UpIHtcblxuXHRcdHZhciBmaWx0ZXJlZCA9IFtdO1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChpdGVtcywgZnVuY3Rpb24oaXRlbSkge1xuXHRcdFx0ZmlsdGVyZWQucHVzaChpdGVtKTtcblx0XHR9KTtcblxuXHRcdHZhciBmaWVsZE9yZGVyID0gYW5ndWxhci5jb3B5KHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZmllbGRPcmRlcik7XG5cdFx0Ly8gcmV2ZXJzZSB0byBtb3ZlIGN1c3RvbSBpdGVtcyB0byB0aGUgZW5kIChpbmRleE9mID09IC0xKVxuXHRcdGZpZWxkT3JkZXIucmV2ZXJzZSgpO1xuXG5cdFx0ZmlsdGVyZWQuc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHRcdFx0aWYoZmllbGRPcmRlci5pbmRleE9mKGFbZmllbGRdKSA8IGZpZWxkT3JkZXIuaW5kZXhPZihiW2ZpZWxkXSkpIHtcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHR9XG5cdFx0XHRpZihmaWVsZE9yZGVyLmluZGV4T2YoYVtmaWVsZF0pID4gZmllbGRPcmRlci5pbmRleE9mKGJbZmllbGRdKSkge1xuXHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9KTtcblxuXHRcdGlmKHJldmVyc2UpIGZpbHRlcmVkLnJldmVyc2UoKTtcblx0XHRyZXR1cm4gZmlsdGVyZWQ7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCd0b0FycmF5JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihvYmopIHtcblx0XHRpZiAoIShvYmogaW5zdGFuY2VvZiBPYmplY3QpKSByZXR1cm4gb2JqO1xuXHRcdHJldHVybiBfLm1hcChvYmosIGZ1bmN0aW9uKHZhbCwga2V5KSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmRlZmluZVByb3BlcnR5KHZhbCwgJyRrZXknLCB7dmFsdWU6IGtleX0pO1xuXHRcdH0pO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcigndkNhcmQySlNPTicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gdkNhcmQucGFyc2UoaW5wdXQpO1xuXHR9O1xufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=
