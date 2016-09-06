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
	ctrl.canExport = oc_config.version.split('.') >= [9, 0, 2, 0];
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
				input.get(0).value = '';
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
		addContact : t('contacts', '+ New contact'),
		emptySearch : t('contacts', 'No search result for {query}', {query: ctrl.searchTerm})
	};

	$scope.getCountString = function(contacts) {
		return n('contacts', '%n contact', '%n contacts', contacts.length);
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
	if (!_.isUndefined(ctrl.data) && !_.isUndefined(ctrl.data.namespace)) {
		if (!_.isUndefined(ctrl.model.contact.props['X-ABLABEL'])) {
			var val = _.find(this.model.contact.props['X-ABLABEL'], function(x) { return x.namespace === ctrl.data.namespace; });
			ctrl.type = val.value;
			if (!_.isUndefined(val)) {
				// in case the type is not yet in the default list of available options we add it
				if (!ctrl.availableOptions.some(function(e) { return e.id === val.value; } )) {
					ctrl.availableOptions = ctrl.availableOptions.concat([{id: val.value, name: val.value}]);
				}
			}
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
.controller('newContactButtonCtrl', ['$scope', 'ContactService', '$routeParams', 'vCardPropertiesService', function($scope, ContactService, $routeParams, vCardPropertiesService) {
	var ctrl = this;

	ctrl.t = {
		addContact : t('contacts', '+ New contact')
	};

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
}]);

angular.module('contactsApp')
.directive('newcontactbutton', function() {
	return {
		restrict: 'EA', // has to be an attribute to work with core css
		scope: {},
		controller: 'newContactButtonCtrl',
		controllerAs: 'ctrl',
		bindToController: {},
		templateUrl: OC.linkTo('contacts', 'templates/newContactButton.html')
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

			rev: function(value) {
				var model = this;
				if (angular.isDefined(value)) {
					// setter
					return model.setProperty('rev', { value: value });
				} else {
					// getter
					return model.getProperty('rev').value;
				}
			},

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
					if (!imageType.startsWith('image/')) {
						return;
					}
					imageType = imageType.substring(6).toUpperCase();

					return this.setProperty('photo', { value: imageData[1], meta: {type: [imageType], encoding: ['b']} });
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
			OC.Notification.showTemporary(t('contacts', 'Contact could not be created.'));
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
		// update rev field
		contact.rev(new Date().toISOString());

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
		anniversary: {
			readableName: t('contacts', 'Anniversary'),
			template: 'date'
		},
		deathdate: {
			readableName: t('contacts', 'Date of death'),
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
		'anniversary',
		'deathdate',
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
		return filter;
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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJkYXRlcGlja2VyX2RpcmVjdGl2ZS5qcyIsImZvY3VzX2RpcmVjdGl2ZS5qcyIsImlucHV0cmVzaXplX2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rL2FkZHJlc3NCb29rX2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9vay9hZGRyZXNzQm9va19kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2RpcmVjdGl2ZS5qcyIsImF2YXRhci9hdmF0YXJfY29udHJvbGxlci5qcyIsImF2YXRhci9hdmF0YXJfZGlyZWN0aXZlLmpzIiwiY29udGFjdC9jb250YWN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0L2NvbnRhY3RfZGlyZWN0aXZlLmpzIiwiY29udGFjdERldGFpbHMvY29udGFjdERldGFpbHNfY29udHJvbGxlci5qcyIsImNvbnRhY3REZXRhaWxzL2NvbnRhY3REZXRhaWxzX2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RJbXBvcnQvY29udGFjdEltcG9ydF9jb250cm9sbGVyLmpzIiwiY29udGFjdEltcG9ydC9jb250YWN0SW1wb3J0X2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RMaXN0L2NvbnRhY3RMaXN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0TGlzdC9jb250YWN0TGlzdF9kaXJlY3RpdmUuanMiLCJkZXRhaWxzSXRlbS9kZXRhaWxzSXRlbV9jb250cm9sbGVyLmpzIiwiZGV0YWlsc0l0ZW0vZGV0YWlsc0l0ZW1fZGlyZWN0aXZlLmpzIiwiZ3JvdXAvZ3JvdXBfY29udHJvbGxlci5qcyIsImdyb3VwL2dyb3VwX2RpcmVjdGl2ZS5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfY29udHJvbGxlci5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfZGlyZWN0aXZlLmpzIiwibmV3Q29udGFjdEJ1dHRvbi9uZXdDb250YWN0QnV0dG9uX2NvbnRyb2xsZXIuanMiLCJuZXdDb250YWN0QnV0dG9uL25ld0NvbnRhY3RCdXR0b25fZGlyZWN0aXZlLmpzIiwicGFyc2Vycy9ncm91cE1vZGVsX2RpcmVjdGl2ZS5qcyIsInBhcnNlcnMvdGVsTW9kZWxfZGlyZWN0aXZlLmpzIiwiYWRkcmVzc0Jvb2tfbW9kZWwuanMiLCJjb250YWN0X21vZGVsLmpzIiwiYWRkcmVzc0Jvb2tfc2VydmljZS5qcyIsImNvbnRhY3Rfc2VydmljZS5qcyIsImRhdkNsaWVudF9zZXJ2aWNlLmpzIiwiZGF2X3NlcnZpY2UuanMiLCJzZWFyY2hfc2VydmljZS5qcyIsInNldHRpbmdzX3NlcnZpY2UuanMiLCJ2Q2FyZFByb3BlcnRpZXMuanMiLCJKU09OMnZDYXJkX2ZpbHRlci5qcyIsImNvbnRhY3RDb2xvcl9maWx0ZXIuanMiLCJjb250YWN0R3JvdXBfZmlsdGVyLmpzIiwiZmllbGRfZmlsdGVyLmpzIiwiZmlyc3RDaGFyYWN0ZXJfZmlsdGVyLmpzIiwibG9jYWxlT3JkZXJCeV9maWx0ZXIuanMiLCJuZXdDb250YWN0X2ZpbHRlci5qcyIsIm9yZGVyRGV0YWlsSXRlbXNfZmlsdGVyLmpzIiwidG9BcnJheV9maWx0ZXIuanMiLCJ2Q2FyZDJKU09OX2ZpbHRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztBQVVBLFFBQVEsT0FBTyxlQUFlLENBQUMsU0FBUyxpQkFBaUIsV0FBVyxnQkFBZ0IsYUFBYTtDQUNoRywwQkFBTyxTQUFTLGdCQUFnQjs7Q0FFaEMsZUFBZSxLQUFLLFNBQVM7RUFDNUIsVUFBVTs7O0NBR1gsZUFBZSxLQUFLLGNBQWM7RUFDakMsVUFBVTs7O0NBR1gsZUFBZSxVQUFVLE1BQU0sRUFBRSxZQUFZOzs7QUFHOUM7QUN4QkEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxjQUFjLFdBQVc7Q0FDbkMsT0FBTztFQUNOLFVBQVU7RUFDVixVQUFVO0VBQ1YsT0FBTyxVQUFVLE9BQU8sU0FBUyxPQUFPLGFBQWE7R0FDcEQsRUFBRSxXQUFX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Q1RBLFFBQVEsT0FBTztDQUNkLE9BQU8sY0FBYyxXQUFXO0NBQ2hDLE9BQU8sU0FBUyxPQUFPO0VBQ3RCLE9BQU8sTUFBTSxNQUFNOzs7QUFHckIiLCJmaWxlIjoic2NyaXB0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBvd25DbG91ZCAtIGNvbnRhY3RzXG4gKlxuICogVGhpcyBmaWxlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSB2ZXJzaW9uIDMgb3JcbiAqIGxhdGVyLiBTZWUgdGhlIENPUFlJTkcgZmlsZS5cbiAqXG4gKiBAYXV0aG9yIEhlbmRyaWsgTGVwcGVsc2FjayA8aGVuZHJpa0BsZXBwZWxzYWNrLmRlPlxuICogQGNvcHlyaWdodCBIZW5kcmlrIExlcHBlbHNhY2sgMjAxNVxuICovXG5cbmFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcsIFsndXVpZDQnLCAnYW5ndWxhci1jYWNoZScsICduZ1JvdXRlJywgJ3VpLmJvb3RzdHJhcCcsICd1aS5zZWxlY3QnLCAnbmdTYW5pdGl6ZSddKVxuLmNvbmZpZyhmdW5jdGlvbigkcm91dGVQcm92aWRlcikge1xuXG5cdCRyb3V0ZVByb3ZpZGVyLndoZW4oJy86Z2lkJywge1xuXHRcdHRlbXBsYXRlOiAnPGNvbnRhY3RkZXRhaWxzPjwvY29udGFjdGRldGFpbHM+J1xuXHR9KTtcblxuXHQkcm91dGVQcm92aWRlci53aGVuKCcvOmdpZC86dWlkJywge1xuXHRcdHRlbXBsYXRlOiAnPGNvbnRhY3RkZXRhaWxzPjwvY29udGFjdGRldGFpbHM+J1xuXHR9KTtcblxuXHQkcm91dGVQcm92aWRlci5vdGhlcndpc2UoJy8nICsgdCgnY29udGFjdHMnLCAnQWxsIGNvbnRhY3RzJykpO1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdkYXRlcGlja2VyJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRyZXF1aXJlIDogJ25nTW9kZWwnLFxuXHRcdGxpbmsgOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBuZ01vZGVsQ3RybCkge1xuXHRcdFx0JChmdW5jdGlvbigpIHtcblx0XHRcdFx0ZWxlbWVudC5kYXRlcGlja2VyKHtcblx0XHRcdFx0XHRkYXRlRm9ybWF0Oid5eS1tbS1kZCcsXG5cdFx0XHRcdFx0bWluRGF0ZTogbnVsbCxcblx0XHRcdFx0XHRtYXhEYXRlOiBudWxsLFxuXHRcdFx0XHRcdG9uU2VsZWN0OmZ1bmN0aW9uIChkYXRlKSB7XG5cdFx0XHRcdFx0XHRuZ01vZGVsQ3RybC4kc2V0Vmlld1ZhbHVlKGRhdGUpO1xuXHRcdFx0XHRcdFx0c2NvcGUuJGFwcGx5KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2ZvY3VzRXhwcmVzc2lvbicsIGZ1bmN0aW9uICgkdGltZW91dCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0bGluazoge1xuXHRcdFx0cG9zdDogZnVuY3Rpb24gcG9zdExpbmsoc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG5cdFx0XHRcdHNjb3BlLiR3YXRjaChhdHRycy5mb2N1c0V4cHJlc3Npb24sIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoYXR0cnMuZm9jdXNFeHByZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRpZiAoc2NvcGUuJGV2YWwoYXR0cnMuZm9jdXNFeHByZXNzaW9uKSkge1xuXHRcdFx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGVsZW1lbnQuaXMoJ2lucHV0JykpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZWxlbWVudC5maW5kKCdpbnB1dCcpLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LCAxMDApOyAvL25lZWQgc29tZSBkZWxheSB0byB3b3JrIHdpdGggbmctZGlzYWJsZWRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2lucHV0cmVzaXplJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRsaW5rIDogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgZWxJbnB1dCA9IGVsZW1lbnQudmFsKCk7XG5cdFx0XHRlbGVtZW50LmJpbmQoJ2tleWRvd24ga2V5dXAgbG9hZCBmb2N1cycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRlbElucHV0ID0gZWxlbWVudC52YWwoKTtcblx0XHRcdFx0Ly8gSWYgc2V0IHRvIDAsIHRoZSBtaW4td2lkdGggY3NzIGRhdGEgaXMgaWdub3JlZFxuXHRcdFx0XHR2YXIgbGVuZ3RoID0gZWxJbnB1dC5sZW5ndGggPiAxID8gZWxJbnB1dC5sZW5ndGggOiAxO1xuXHRcdFx0XHRlbGVtZW50LmF0dHIoJ3NpemUnLCBsZW5ndGgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2FkZHJlc3Nib29rQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgQWRkcmVzc0Jvb2tTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnNob3dVcmwgPSBmYWxzZTtcblx0LyogZ2xvYmFscyBvY19jb25maWcgKi9cblx0LyogZXNsaW50LWRpc2FibGUgY2FtZWxjYXNlICovXG5cdGN0cmwuY2FuRXhwb3J0ID0gb2NfY29uZmlnLnZlcnNpb24uc3BsaXQoJy4nKSA+PSBbOSwgMCwgMiwgMF07XG5cdC8qIGVzbGludC1lbmFibGUgY2FtZWxjYXNlICovXG5cblx0Y3RybC50b2dnbGVTaG93VXJsID0gZnVuY3Rpb24oKSB7XG5cdFx0Y3RybC5zaG93VXJsID0gIWN0cmwuc2hvd1VybDtcblx0fTtcblxuXHRjdHJsLnRvZ2dsZVNoYXJlc0VkaXRvciA9IGZ1bmN0aW9uKCkge1xuXHRcdGN0cmwuZWRpdGluZ1NoYXJlcyA9ICFjdHJsLmVkaXRpbmdTaGFyZXM7XG5cdFx0Y3RybC5zZWxlY3RlZFNoYXJlZSA9IG51bGw7XG5cdH07XG5cblx0LyogRnJvbSBDYWxlbmRhci1SZXdvcmsgLSBqcy9hcHAvY29udHJvbGxlcnMvY2FsZW5kYXJsaXN0Y29udHJvbGxlci5qcyAqL1xuXHRjdHJsLmZpbmRTaGFyZWUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0cmV0dXJuICQuZ2V0KFxuXHRcdFx0T0MubGlua1RvT0NTKCdhcHBzL2ZpbGVzX3NoYXJpbmcvYXBpL3YxJykgKyAnc2hhcmVlcycsXG5cdFx0XHR7XG5cdFx0XHRcdGZvcm1hdDogJ2pzb24nLFxuXHRcdFx0XHRzZWFyY2g6IHZhbC50cmltKCksXG5cdFx0XHRcdHBlclBhZ2U6IDIwMCxcblx0XHRcdFx0aXRlbVR5cGU6ICdwcmluY2lwYWxzJ1xuXHRcdFx0fVxuXHRcdCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdC8vIFRvZG8gLSBmaWx0ZXIgb3V0IGN1cnJlbnQgdXNlciwgZXhpc3Rpbmcgc2hhcmVlc1xuXHRcdFx0dmFyIHVzZXJzICAgPSByZXN1bHQub2NzLmRhdGEuZXhhY3QudXNlcnMuY29uY2F0KHJlc3VsdC5vY3MuZGF0YS51c2Vycyk7XG5cdFx0XHR2YXIgZ3JvdXBzICA9IHJlc3VsdC5vY3MuZGF0YS5leGFjdC5ncm91cHMuY29uY2F0KHJlc3VsdC5vY3MuZGF0YS5ncm91cHMpO1xuXG5cdFx0XHR2YXIgdXNlclNoYXJlcyA9IGN0cmwuYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycztcblx0XHRcdHZhciB1c2VyU2hhcmVzTGVuZ3RoID0gdXNlclNoYXJlcy5sZW5ndGg7XG5cdFx0XHR2YXIgaSwgajtcblxuXHRcdFx0Ly8gRmlsdGVyIG91dCBjdXJyZW50IHVzZXJcblx0XHRcdHZhciB1c2Vyc0xlbmd0aCA9IHVzZXJzLmxlbmd0aDtcblx0XHRcdGZvciAoaSA9IDAgOyBpIDwgdXNlcnNMZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodXNlcnNbaV0udmFsdWUuc2hhcmVXaXRoID09PSBPQy5jdXJyZW50VXNlcikge1xuXHRcdFx0XHRcdHVzZXJzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBOb3cgZmlsdGVyIG91dCBhbGwgc2hhcmVlcyB0aGF0IGFyZSBhbHJlYWR5IHNoYXJlZCB3aXRoXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgdXNlclNoYXJlc0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHZhciBzaGFyZSA9IHVzZXJTaGFyZXNbaV07XG5cdFx0XHRcdHVzZXJzTGVuZ3RoID0gdXNlcnMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKGogPSAwOyBqIDwgdXNlcnNMZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdGlmICh1c2Vyc1tqXS52YWx1ZS5zaGFyZVdpdGggPT09IHNoYXJlLmlkKSB7XG5cdFx0XHRcdFx0XHR1c2Vycy5zcGxpY2UoaiwgMSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29tYmluZSB1c2VycyBhbmQgZ3JvdXBzXG5cdFx0XHR1c2VycyA9IHVzZXJzLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGlzcGxheTogaXRlbS52YWx1ZS5zaGFyZVdpdGgsXG5cdFx0XHRcdFx0dHlwZTogT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSLFxuXHRcdFx0XHRcdGlkZW50aWZpZXI6IGl0ZW0udmFsdWUuc2hhcmVXaXRoXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdFx0Z3JvdXBzID0gZ3JvdXBzLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGlzcGxheTogaXRlbS52YWx1ZS5zaGFyZVdpdGggKyAnIChncm91cCknLFxuXHRcdFx0XHRcdHR5cGU6IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsXG5cdFx0XHRcdFx0aWRlbnRpZmllcjogaXRlbS52YWx1ZS5zaGFyZVdpdGhcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gZ3JvdXBzLmNvbmNhdCh1c2Vycyk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5vblNlbGVjdFNoYXJlZSA9IGZ1bmN0aW9uIChpdGVtKSB7XG5cdFx0Y3RybC5zZWxlY3RlZFNoYXJlZSA9IG51bGw7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIGl0ZW0udHlwZSwgaXRlbS5pZGVudGlmaWVyLCBmYWxzZSwgZmFsc2UpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cblx0fTtcblxuXHRjdHJsLnVwZGF0ZUV4aXN0aW5nVXNlclNoYXJlID0gZnVuY3Rpb24odXNlcklkLCB3cml0YWJsZSkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIsIHVzZXJJZCwgd3JpdGFibGUsIHRydWUpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVFeGlzdGluZ0dyb3VwU2hhcmUgPSBmdW5jdGlvbihncm91cElkLCB3cml0YWJsZSkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLCBncm91cElkLCB3cml0YWJsZSwgdHJ1ZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVuc2hhcmVGcm9tVXNlciA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS51bnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUiwgdXNlcklkKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudW5zaGFyZUZyb21Hcm91cCA9IGZ1bmN0aW9uKGdyb3VwSWQpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UudW5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLCBncm91cElkKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlQWRkcmVzc0Jvb2sgPSBmdW5jdGlvbigpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZGVsZXRlKGN0cmwuYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2FkZHJlc3Nib29rJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0YWRkcmVzc0Jvb2s6ICc9ZGF0YScsXG5cdFx0XHRsaXN0OiAnPSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9vay5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdhZGRyZXNzYm9va2xpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBBZGRyZXNzQm9va1NlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cblx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0Y3RybC5hZGRyZXNzQm9va3MgPSBhZGRyZXNzQm9va3M7XG5cdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdH0pO1xuXG5cdGN0cmwudCA9IHtcblx0XHRhZGRyZXNzQm9va05hbWUgOiB0KCdjb250YWN0cycsICdBZGRyZXNzIGJvb2sgbmFtZScpXG5cdH07XG5cblx0Y3RybC5jcmVhdGVBZGRyZXNzQm9vayA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKSB7XG5cdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuY3JlYXRlKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWRkcmVzc0Jvb2soY3RybC5uZXdBZGRyZXNzQm9va05hbWUpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRjdHJsLmFkZHJlc3NCb29rcy5wdXNoKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYWRkcmVzc2Jvb2tsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdhZGRyZXNzYm9va2xpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYWRkcmVzc0Jvb2tMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2F2YXRhckN0cmwnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5pbXBvcnQgPSBDb250YWN0U2VydmljZS5pbXBvcnQuYmluZChDb250YWN0U2VydmljZSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2F2YXRhcicsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHJldHVybiB7XG5cdFx0c2NvcGU6IHtcblx0XHRcdGNvbnRhY3Q6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgaW1wb3J0VGV4dCA9IHQoJ2NvbnRhY3RzJywgJ0ltcG9ydCcpO1xuXHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cblx0XHRcdHZhciBpbnB1dCA9IGVsZW1lbnQuZmluZCgnaW5wdXQnKTtcblx0XHRcdGlucHV0LmJpbmQoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZmlsZSA9IGlucHV0LmdldCgwKS5maWxlc1swXTtcblx0XHRcdFx0aWYgKGZpbGUuc2l6ZSA+IDEwMjQqMTAyNCkgeyAvLyAxIE1CXG5cdFx0XHRcdFx0T0MuTm90aWZpY2F0aW9uLnNob3dUZW1wb3JhcnkodCgnY29udGFjdHMnLCAnVGhlIHNlbGVjdGVkIGltYWdlIGlzIHRvbyBiaWcgKG1heCAxTUIpJykpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXG5cdFx0XHRcdFx0cmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdHNjb3BlLmNvbnRhY3QucGhvdG8ocmVhZGVyLnJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdENvbnRhY3RTZXJ2aWNlLnVwZGF0ZShzY29wZS5jb250YWN0KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0sIGZhbHNlKTtcblxuXHRcdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0XHRyZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2F2YXRhci5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdjb250YWN0Q3RybCcsIGZ1bmN0aW9uKCRyb3V0ZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLm9wZW5Db250YWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHR1aWQ6IGN0cmwuY29udGFjdC51aWQoKX0pO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnY29udGFjdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGNvbnRhY3Q6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RkZXRhaWxzQ3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlLCBBZGRyZXNzQm9va1NlcnZpY2UsIHZDYXJkUHJvcGVydGllc1NlcnZpY2UsICRyb3V0ZSwgJHJvdXRlUGFyYW1zLCAkc2NvcGUpIHtcblxuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblx0Y3RybC5zaG93ID0gZmFsc2U7XG5cblx0Y3RybC5jbGVhckNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdHVpZDogdW5kZWZpbmVkXG5cdFx0fSk7XG5cdFx0Y3RybC5zaG93ID0gZmFsc2U7XG5cdFx0Y3RybC5jb250YWN0ID0gdW5kZWZpbmVkO1xuXHR9O1xuXG5cdGN0cmwudWlkID0gJHJvdXRlUGFyYW1zLnVpZDtcblx0Y3RybC50ID0ge1xuXHRcdG5vQ29udGFjdHMgOiB0KCdjb250YWN0cycsICdObyBjb250YWN0cyBpbiBoZXJlJyksXG5cdFx0cGxhY2Vob2xkZXJOYW1lIDogdCgnY29udGFjdHMnLCAnTmFtZScpLFxuXHRcdHBsYWNlaG9sZGVyT3JnIDogdCgnY29udGFjdHMnLCAnT3JnYW5pemF0aW9uJyksXG5cdFx0cGxhY2Vob2xkZXJUaXRsZSA6IHQoJ2NvbnRhY3RzJywgJ1RpdGxlJyksXG5cdFx0c2VsZWN0RmllbGQgOiB0KCdjb250YWN0cycsICdBZGQgZmllbGQgLi4uJylcblx0fTtcblxuXHRjdHJsLmZpZWxkRGVmaW5pdGlvbnMgPSB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmZpZWxkRGVmaW5pdGlvbnM7XG5cdGN0cmwuZm9jdXMgPSB1bmRlZmluZWQ7XG5cdGN0cmwuZmllbGQgPSB1bmRlZmluZWQ7XG5cdGN0cmwuYWRkcmVzc0Jvb2tzID0gW107XG5cblx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0Y3RybC5hZGRyZXNzQm9va3MgPSBhZGRyZXNzQm9va3M7XG5cblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoY3RybC5jb250YWN0KSkge1xuXHRcdFx0Y3RybC5hZGRyZXNzQm9vayA9IF8uZmluZChjdHJsLmFkZHJlc3NCb29rcywgZnVuY3Rpb24oYm9vaykge1xuXHRcdFx0XHRyZXR1cm4gYm9vay5kaXNwbGF5TmFtZSA9PT0gY3RybC5jb250YWN0LmFkZHJlc3NCb29rSWQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwudWlkJywgZnVuY3Rpb24obmV3VmFsdWUpIHtcblx0XHRjdHJsLmNoYW5nZUNvbnRhY3QobmV3VmFsdWUpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZUNvbnRhY3QgPSBmdW5jdGlvbih1aWQpIHtcblx0XHRpZiAodHlwZW9mIHVpZCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdFx0JCgnI2FwcC1uYXZpZ2F0aW9uLXRvZ2dsZScpLnJlbW92ZUNsYXNzKCdzaG93ZGV0YWlscycpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRDb250YWN0U2VydmljZS5nZXRCeUlkKHVpZCkudGhlbihmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0XHRpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChjb250YWN0KSkge1xuXHRcdFx0XHRjdHJsLmNsZWFyQ29udGFjdCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmNvbnRhY3QgPSBjb250YWN0O1xuXHRcdFx0Y3RybC5zaG93ID0gdHJ1ZTtcblx0XHRcdCQoJyNhcHAtbmF2aWdhdGlvbi10b2dnbGUnKS5hZGRDbGFzcygnc2hvd2RldGFpbHMnKTtcblxuXHRcdFx0Y3RybC5hZGRyZXNzQm9vayA9IF8uZmluZChjdHJsLmFkZHJlc3NCb29rcywgZnVuY3Rpb24oYm9vaykge1xuXHRcdFx0XHRyZXR1cm4gYm9vay5kaXNwbGF5TmFtZSA9PT0gY3RybC5jb250YWN0LmFkZHJlc3NCb29rSWQ7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVwZGF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS51cGRhdGUoY3RybC5jb250YWN0KTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5kZWxldGUoY3RybC5jb250YWN0KTtcblx0fTtcblxuXHRjdHJsLmFkZEZpZWxkID0gZnVuY3Rpb24oZmllbGQpIHtcblx0XHR2YXIgZGVmYXVsdFZhbHVlID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGZpZWxkKS5kZWZhdWx0VmFsdWUgfHwge3ZhbHVlOiAnJ307XG5cdFx0Y3RybC5jb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdGN0cmwuZm9jdXMgPSBmaWVsZDtcblx0XHRjdHJsLmZpZWxkID0gJyc7XG5cdH07XG5cblx0Y3RybC5kZWxldGVGaWVsZCA9IGZ1bmN0aW9uIChmaWVsZCwgcHJvcCkge1xuXHRcdGN0cmwuY29udGFjdC5yZW1vdmVQcm9wZXJ0eShmaWVsZCwgcHJvcCk7XG5cdFx0Y3RybC5mb2N1cyA9IHVuZGVmaW5lZDtcblx0fTtcblxuXHRjdHJsLmNoYW5nZUFkZHJlc3NCb29rID0gZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0Q29udGFjdFNlcnZpY2UubW92ZUNvbnRhY3QoY3RybC5jb250YWN0LCBhZGRyZXNzQm9vayk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0ZGV0YWlscycsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHByaW9yaXR5OiAxLFxuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnY29udGFjdGRldGFpbHNDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdERldGFpbHMuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGltcG9ydEN0cmwnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5pbXBvcnQgPSBDb250YWN0U2VydmljZS5pbXBvcnQuYmluZChDb250YWN0U2VydmljZSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RpbXBvcnQnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHRyZXR1cm4ge1xuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgaW1wb3J0VGV4dCA9IHQoJ2NvbnRhY3RzJywgJ0ltcG9ydCcpO1xuXHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cblx0XHRcdHZhciBpbnB1dCA9IGVsZW1lbnQuZmluZCgnaW5wdXQnKTtcblx0XHRcdGlucHV0LmJpbmQoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZmlsZSA9IGlucHV0LmdldCgwKS5maWxlc1swXTtcblx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0cmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0c2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdFx0Q29udGFjdFNlcnZpY2UuaW1wb3J0LmNhbGwoQ29udGFjdFNlcnZpY2UsIHJlYWRlci5yZXN1bHQsIGZpbGUudHlwZSwgbnVsbCwgZnVuY3Rpb24ocHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHRcdFx0aWYocHJvZ3Jlc3M9PT0xKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IHBhcnNlSW50KE1hdGguZmxvb3IocHJvZ3Jlc3MqMTAwKSkrJyUnO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0cmVhZGVyLnJlYWRBc1RleHQoZmlsZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aW5wdXQuZ2V0KDApLnZhbHVlID0gJyc7XG5cdFx0XHR9KTtcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0SW1wb3J0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RsaXN0Q3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgJGZpbHRlciwgJHJvdXRlLCAkcm91dGVQYXJhbXMsIENvbnRhY3RTZXJ2aWNlLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCBTZWFyY2hTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnJvdXRlUGFyYW1zID0gJHJvdXRlUGFyYW1zO1xuXG5cdGN0cmwuY29udGFjdExpc3QgPSBbXTtcblx0Y3RybC5zZWFyY2hUZXJtID0gJyc7XG5cdGN0cmwuc2hvdyA9IHRydWU7XG5cdGN0cmwuaW52YWxpZCA9IGZhbHNlO1xuXG5cdGN0cmwudCA9IHtcblx0XHRhZGRDb250YWN0IDogdCgnY29udGFjdHMnLCAnKyBOZXcgY29udGFjdCcpLFxuXHRcdGVtcHR5U2VhcmNoIDogdCgnY29udGFjdHMnLCAnTm8gc2VhcmNoIHJlc3VsdCBmb3Ige3F1ZXJ5fScsIHtxdWVyeTogY3RybC5zZWFyY2hUZXJtfSlcblx0fTtcblxuXHQkc2NvcGUuZ2V0Q291bnRTdHJpbmcgPSBmdW5jdGlvbihjb250YWN0cykge1xuXHRcdHJldHVybiBuKCdjb250YWN0cycsICclbiBjb250YWN0JywgJyVuIGNvbnRhY3RzJywgY29udGFjdHMubGVuZ3RoKTtcblx0fTtcblxuXHQkc2NvcGUucXVlcnkgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0cmV0dXJuIGNvbnRhY3QubWF0Y2hlcyhTZWFyY2hTZXJ2aWNlLmdldFNlYXJjaFRlcm0oKSk7XG5cdH07XG5cblx0U2VhcmNoU2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oZXYpIHtcblx0XHRpZiAoZXYuZXZlbnQgPT09ICdzdWJtaXRTZWFyY2gnKSB7XG5cdFx0XHR2YXIgdWlkID0gIV8uaXNFbXB0eShjdHJsLmNvbnRhY3RMaXN0KSA/IGN0cmwuY29udGFjdExpc3RbMF0udWlkKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQodWlkKTtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9XG5cdFx0aWYgKGV2LmV2ZW50ID09PSAnY2hhbmdlU2VhcmNoJykge1xuXHRcdFx0Y3RybC5zZWFyY2hUZXJtID0gZXYuc2VhcmNoVGVybTtcblx0XHRcdGN0cmwudC5lbXB0eVNlYXJjaCA9IHQoJ2NvbnRhY3RzJyxcblx0XHRcdFx0XHRcdFx0XHQgICAnTm8gc2VhcmNoIHJlc3VsdCBmb3Ige3F1ZXJ5fScsXG5cdFx0XHRcdFx0XHRcdFx0ICAge3F1ZXJ5OiBjdHJsLnNlYXJjaFRlcm19XG5cdFx0XHRcdFx0XHRcdFx0ICApO1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH1cblx0fSk7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oZXYpIHtcblx0XHQkc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGV2LmV2ZW50ID09PSAnZGVsZXRlJykge1xuXHRcdFx0XHRpZiAoY3RybC5jb250YWN0TGlzdC5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdHVpZDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGN0cmwuY29udGFjdExpc3QubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGlmIChjdHJsLmNvbnRhY3RMaXN0W2ldLnVpZCgpID09PSBldi51aWQpIHtcblx0XHRcdFx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0XHRcdHVpZDogKGN0cmwuY29udGFjdExpc3RbaSsxXSkgPyBjdHJsLmNvbnRhY3RMaXN0W2krMV0udWlkKCkgOiBjdHJsLmNvbnRhY3RMaXN0W2ktMV0udWlkKClcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoZXYuZXZlbnQgPT09ICdjcmVhdGUnKSB7XG5cdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHR1aWQ6IGV2LnVpZFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGN0cmwuY29udGFjdHMgPSBldi5jb250YWN0cztcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gR2V0IGNvbnRhY3RzXG5cdENvbnRhY3RTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRpZihjb250YWN0cy5sZW5ndGg+MCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0Y3RybC5jb250YWN0cyA9IGNvbnRhY3RzO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdH1cblx0fSk7XG5cblx0Ly8gV2FpdCBmb3IgY3RybC5jb250YWN0TGlzdCB0byBiZSB1cGRhdGVkLCBsb2FkIHRoZSBmaXJzdCBjb250YWN0IGFuZCBraWxsIHRoZSB3YXRjaFxuXHR2YXIgdW5iaW5kTGlzdFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBDaGVjayBpZiBhIHNwZWNpZmljIHVpZCBpcyByZXF1ZXN0ZWRcblx0XHRcdGlmKCRyb3V0ZVBhcmFtcy51aWQgJiYgJHJvdXRlUGFyYW1zLmdpZCkge1xuXHRcdFx0XHRjdHJsLmNvbnRhY3RMaXN0LmZvckVhY2goZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdFx0XHRcdGlmKGNvbnRhY3QudWlkKCkgPT09ICRyb3V0ZVBhcmFtcy51aWQpIHtcblx0XHRcdFx0XHRcdGN0cmwuc2V0U2VsZWN0ZWRJZCgkcm91dGVQYXJhbXMudWlkKTtcblx0XHRcdFx0XHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBObyBjb250YWN0IHByZXZpb3VzbHkgbG9hZGVkLCBsZXQncyBsb2FkIHRoZSBmaXJzdCBvZiB0aGUgbGlzdCBpZiBub3QgaW4gbW9iaWxlIG1vZGVcblx0XHRcdGlmKGN0cmwubG9hZGluZyAmJiAkKHdpbmRvdykud2lkdGgoKSA+IDc2OCkge1xuXHRcdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQoY3RybC5jb250YWN0TGlzdFswXS51aWQoKSk7XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdHVuYmluZExpc3RXYXRjaCgpO1xuXHRcdH1cblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC5yb3V0ZVBhcmFtcy51aWQnLCBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcblx0XHQvLyBVc2VkIGZvciBtb2JpbGUgdmlldyB0byBjbGVhciB0aGUgdXJsXG5cdFx0aWYodHlwZW9mIG9sZFZhbHVlICE9ICd1bmRlZmluZWQnICYmIHR5cGVvZiBuZXdWYWx1ZSA9PSAndW5kZWZpbmVkJyAmJiAkKHdpbmRvdykud2lkdGgoKSA8PSA3NjgpIHtcblx0XHRcdC8vIG5vIGNvbnRhY3Qgc2VsZWN0ZWRcblx0XHRcdGN0cmwuc2hvdyA9IHRydWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmKG5ld1ZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIHdlIG1pZ2h0IGhhdmUgdG8gd2FpdCB1bnRpbCBuZy1yZXBlYXQgZmlsbGVkIHRoZSBjb250YWN0TGlzdFxuXHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHdhdGNoIGZvciBuZXh0IGNvbnRhY3RMaXN0IHVwZGF0ZVxuXHRcdFx0XHR2YXIgdW5iaW5kV2F0Y2ggPSAkc2NvcGUuJHdhdGNoKCdjdHJsLmNvbnRhY3RMaXN0JywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHVuYmluZFdhdGNoKCk7IC8vIHVuYmluZCBhcyB3ZSBvbmx5IHdhbnQgb25lIHVwZGF0ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZGlzcGxheWluZyBjb250YWN0IGRldGFpbHNcblx0XHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdH1cblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC5yb3V0ZVBhcmFtcy5naWQnLCBmdW5jdGlvbigpIHtcblx0XHQvLyB3ZSBtaWdodCBoYXZlIHRvIHdhaXQgdW50aWwgbmctcmVwZWF0IGZpbGxlZCB0aGUgY29udGFjdExpc3Rcblx0XHRjdHJsLmNvbnRhY3RMaXN0ID0gW107XG5cdFx0Ly8gbm90IGluIG1vYmlsZSBtb2RlXG5cdFx0aWYoJCh3aW5kb3cpLndpZHRoKCkgPiA3NjgpIHtcblx0XHRcdC8vIHdhdGNoIGZvciBuZXh0IGNvbnRhY3RMaXN0IHVwZGF0ZVxuXHRcdFx0dmFyIHVuYmluZFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZihjdHJsLmNvbnRhY3RMaXN0ICYmIGN0cmwuY29udGFjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0dWlkOiBjdHJsLmNvbnRhY3RMaXN0WzBdLnVpZCgpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dW5iaW5kV2F0Y2goKTsgLy8gdW5iaW5kIGFzIHdlIG9ubHkgd2FudCBvbmUgdXBkYXRlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdhdGNoIGlmIHdlIGhhdmUgYW4gaW52YWxpZCBjb250YWN0XG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3RbMF0uZGlzcGxheU5hbWUoKScsIGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0Y3RybC5pbnZhbGlkID0gKGRpc3BsYXlOYW1lID09PSAnJyk7XG5cdH0pO1xuXG5cdGN0cmwuaGFzQ29udGFjdHMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCFjdHJsLmNvbnRhY3RzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBjdHJsLmNvbnRhY3RzLmxlbmd0aCA+IDA7XG5cdH07XG5cblx0Y3RybC5zZXRTZWxlY3RlZElkID0gZnVuY3Rpb24gKGNvbnRhY3RJZCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0dWlkOiBjb250YWN0SWRcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLmdldFNlbGVjdGVkSWQgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJHJvdXRlUGFyYW1zLnVpZDtcblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdGxpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRwcmlvcml0eTogMSxcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2NvbnRhY3RsaXN0Q3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0YWRkcmVzc2Jvb2s6ICc9YWRyYm9vaydcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0TGlzdC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdkZXRhaWxzSXRlbUN0cmwnLCBmdW5jdGlvbigkdGVtcGxhdGVSZXF1ZXN0LCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCBDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5tZXRhID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGN0cmwubmFtZSk7XG5cdGN0cmwudHlwZSA9IHVuZGVmaW5lZDtcblx0Y3RybC5pc1ByZWZlcnJlZCA9IGZhbHNlO1xuXHRjdHJsLnQgPSB7XG5cdFx0cG9Cb3ggOiB0KCdjb250YWN0cycsICdQb3N0IG9mZmljZSBib3gnKSxcblx0XHRwb3N0YWxDb2RlIDogdCgnY29udGFjdHMnLCAnUG9zdGFsIGNvZGUnKSxcblx0XHRjaXR5IDogdCgnY29udGFjdHMnLCAnQ2l0eScpLFxuXHRcdHN0YXRlIDogdCgnY29udGFjdHMnLCAnU3RhdGUgb3IgcHJvdmluY2UnKSxcblx0XHRjb3VudHJ5IDogdCgnY29udGFjdHMnLCAnQ291bnRyeScpLFxuXHRcdGFkZHJlc3M6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MnKSxcblx0XHRuZXdHcm91cDogdCgnY29udGFjdHMnLCAnKG5ldyBncm91cCknKSxcblx0XHRmYW1pbHlOYW1lOiB0KCdjb250YWN0cycsICdMYXN0IG5hbWUnKSxcblx0XHRmaXJzdE5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZpcnN0IG5hbWUnKSxcblx0XHRhZGRpdGlvbmFsTmFtZXM6IHQoJ2NvbnRhY3RzJywgJ0FkZGl0aW9uYWwgbmFtZXMnKSxcblx0XHRob25vcmlmaWNQcmVmaXg6IHQoJ2NvbnRhY3RzJywgJ1ByZWZpeCcpLFxuXHRcdGhvbm9yaWZpY1N1ZmZpeDogdCgnY29udGFjdHMnLCAnU3VmZml4Jylcblx0fTtcblxuXHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLm1ldGEub3B0aW9ucyB8fCBbXTtcblx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YSkgJiYgIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhLm1ldGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5tZXRhLnR5cGUpKSB7XG5cdFx0Ly8gcGFyc2UgdHlwZSBvZiB0aGUgcHJvcGVydHlcblx0XHR2YXIgYXJyYXkgPSBjdHJsLmRhdGEubWV0YS50eXBlWzBdLnNwbGl0KCcsJyk7XG5cdFx0YXJyYXkgPSBhcnJheS5tYXAoZnVuY3Rpb24gKGVsZW0pIHtcblx0XHRcdHJldHVybiBlbGVtLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKS5yZXBsYWNlKC9cXFxcKyQvLCAnJykudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG5cdFx0fSk7XG5cdFx0Ly8gdGhlIHByZWYgdmFsdWUgaXMgaGFuZGxlZCBvbiBpdHMgb3duIHNvIHRoYXQgd2UgY2FuIGFkZCBzb21lIGZhdm9yaXRlIGljb24gdG8gdGhlIHVpIGlmIHdlIHdhbnRcblx0XHRpZiAoYXJyYXkuaW5kZXhPZignUFJFRicpID49IDApIHtcblx0XHRcdGN0cmwuaXNQcmVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0YXJyYXkuc3BsaWNlKGFycmF5LmluZGV4T2YoJ1BSRUYnKSwgMSk7XG5cdFx0fVxuXHRcdC8vIHNpbXBseSBqb2luIHRoZSB1cHBlciBjYXNlZCB0eXBlcyB0b2dldGhlciBhcyBrZXlcblx0XHRjdHJsLnR5cGUgPSBhcnJheS5qb2luKCcsJyk7XG5cdFx0dmFyIGRpc3BsYXlOYW1lID0gYXJyYXkubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGVsZW1lbnQuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcblx0XHR9KS5qb2luKCcgJyk7XG5cblx0XHQvLyBpbiBjYXNlIHRoZSB0eXBlIGlzIG5vdCB5ZXQgaW4gdGhlIGRlZmF1bHQgbGlzdCBvZiBhdmFpbGFibGUgb3B0aW9ucyB3ZSBhZGQgaXRcblx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IGN0cmwudHlwZTsgfSApKSB7XG5cdFx0XHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLmF2YWlsYWJsZU9wdGlvbnMuY29uY2F0KFt7aWQ6IGN0cmwudHlwZSwgbmFtZTogZGlzcGxheU5hbWV9XSk7XG5cdFx0fVxuXHR9XG5cdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5uYW1lc3BhY2UpKSB7XG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10pKSB7XG5cdFx0XHR2YXIgdmFsID0gXy5maW5kKHRoaXMubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10sIGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHgubmFtZXNwYWNlID09PSBjdHJsLmRhdGEubmFtZXNwYWNlOyB9KTtcblx0XHRcdGN0cmwudHlwZSA9IHZhbC52YWx1ZTtcblx0XHRcdGlmICghXy5pc1VuZGVmaW5lZCh2YWwpKSB7XG5cdFx0XHRcdC8vIGluIGNhc2UgdGhlIHR5cGUgaXMgbm90IHlldCBpbiB0aGUgZGVmYXVsdCBsaXN0IG9mIGF2YWlsYWJsZSBvcHRpb25zIHdlIGFkZCBpdFxuXHRcdFx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IHZhbC52YWx1ZTsgfSApKSB7XG5cdFx0XHRcdFx0Y3RybC5hdmFpbGFibGVPcHRpb25zID0gY3RybC5hdmFpbGFibGVPcHRpb25zLmNvbmNhdChbe2lkOiB2YWwudmFsdWUsIG5hbWU6IHZhbC52YWx1ZX1dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjdHJsLmF2YWlsYWJsZUdyb3VwcyA9IFtdO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5hdmFpbGFibGVHcm91cHMgPSBfLnVuaXF1ZShncm91cHMpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZVR5cGUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0aWYgKGN0cmwuaXNQcmVmZXJyZWQpIHtcblx0XHRcdHZhbCArPSAnLFBSRUYnO1xuXHRcdH1cblx0XHRjdHJsLmRhdGEubWV0YSA9IGN0cmwuZGF0YS5tZXRhIHx8IHt9O1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGUgPSBjdHJsLmRhdGEubWV0YS50eXBlIHx8IFtdO1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGVbMF0gPSB2YWw7XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVEZXRhaWxlZE5hbWUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZuID0gJyc7XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVszXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzNdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzFdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbMV0gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbMl0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVsyXSArICcgJztcblx0XHR9XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVswXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzBdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzRdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbNF07XG5cdFx0fVxuXG5cdFx0Y3RybC5tb2RlbC5jb250YWN0LmZ1bGxOYW1lKGZuKTtcblx0XHRjdHJsLm1vZGVsLnVwZGF0ZUNvbnRhY3QoKTtcblx0fTtcblxuXHRjdHJsLmdldFRlbXBsYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRlbXBsYXRlVXJsID0gT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZGV0YWlsSXRlbXMvJyArIGN0cmwubWV0YS50ZW1wbGF0ZSArICcuaHRtbCcpO1xuXHRcdHJldHVybiAkdGVtcGxhdGVSZXF1ZXN0KHRlbXBsYXRlVXJsKTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwubW9kZWwuZGVsZXRlRmllbGQoY3RybC5uYW1lLCBjdHJsLmRhdGEpO1xuXHRcdGN0cmwubW9kZWwudXBkYXRlQ29udGFjdCgpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZGV0YWlsc2l0ZW0nLCBbJyRjb21waWxlJywgZnVuY3Rpb24oJGNvbXBpbGUpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2RldGFpbHNJdGVtQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0bmFtZTogJz0nLFxuXHRcdFx0ZGF0YTogJz0nLFxuXHRcdFx0bW9kZWw6ICc9J1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XG5cdFx0XHRjdHJsLmdldFRlbXBsYXRlKCkudGhlbihmdW5jdGlvbihodG1sKSB7XG5cdFx0XHRcdHZhciB0ZW1wbGF0ZSA9IGFuZ3VsYXIuZWxlbWVudChodG1sKTtcblx0XHRcdFx0ZWxlbWVudC5hcHBlbmQodGVtcGxhdGUpO1xuXHRcdFx0XHQkY29tcGlsZSh0ZW1wbGF0ZSkoc2NvcGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufV0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cEN0cmwnLCBmdW5jdGlvbigpIHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5cdHZhciBjdHJsID0gdGhpcztcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2dyb3VwJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2dyb3VwQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Z3JvdXA6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9ncm91cC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgU2VhcmNoU2VydmljZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHR2YXIgaW5pdGlhbEdyb3VwcyA9IFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV07XG5cblx0Y3RybC5ncm91cHMgPSBpbml0aWFsR3JvdXBzO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5ncm91cHMgPSBfLnVuaXF1ZShpbml0aWFsR3JvdXBzLmNvbmNhdChncm91cHMpKTtcblx0fSk7XG5cblx0Y3RybC5nZXRTZWxlY3RlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAkcm91dGVQYXJhbXMuZ2lkO1xuXHR9O1xuXG5cdC8vIFVwZGF0ZSBncm91cExpc3Qgb24gY29udGFjdCBhZGQvZGVsZXRlL3VwZGF0ZVxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oKSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0XHRcdGN0cmwuZ3JvdXBzID0gXy51bmlxdWUoaW5pdGlhbEdyb3Vwcy5jb25jYXQoZ3JvdXBzKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Y3RybC5zZXRTZWxlY3RlZCA9IGZ1bmN0aW9uIChzZWxlY3RlZEdyb3VwKSB7XG5cdFx0U2VhcmNoU2VydmljZS5jbGVhblNlYXJjaCgpO1xuXHRcdCRyb3V0ZVBhcmFtcy5naWQgPSBzZWxlY3RlZEdyb3VwO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdncm91cGxpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZ3JvdXBMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ25ld0NvbnRhY3RCdXR0b25DdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgJHJvdXRlUGFyYW1zLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnQgPSB7XG5cdFx0YWRkQ29udGFjdCA6IHQoJ2NvbnRhY3RzJywgJysgTmV3IGNvbnRhY3QnKVxuXHR9O1xuXG5cdGN0cmwuY3JlYXRlQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdENvbnRhY3RTZXJ2aWNlLmNyZWF0ZSgpLnRoZW4oZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdFx0Wyd0ZWwnLCAnYWRyJywgJ2VtYWlsJ10uZm9yRWFjaChmdW5jdGlvbihmaWVsZCkge1xuXHRcdFx0XHR2YXIgZGVmYXVsdFZhbHVlID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGZpZWxkKS5kZWZhdWx0VmFsdWUgfHwge3ZhbHVlOiAnJ307XG5cdFx0XHRcdGNvbnRhY3QuYWRkUHJvcGVydHkoZmllbGQsIGRlZmF1bHRWYWx1ZSk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoW3QoJ2NvbnRhY3RzJywgJ0FsbCBjb250YWN0cycpLCB0KCdjb250YWN0cycsICdOb3QgZ3JvdXBlZCcpXS5pbmRleE9mKCRyb3V0ZVBhcmFtcy5naWQpID09PSAtMSkge1xuXHRcdFx0XHRjb250YWN0LmNhdGVnb3JpZXMoJHJvdXRlUGFyYW1zLmdpZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250YWN0LmNhdGVnb3JpZXMoJycpO1xuXHRcdFx0fVxuXHRcdFx0JCgnI2RldGFpbHMtZnVsbE5hbWUnKS5mb2N1cygpO1xuXHRcdH0pO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnbmV3Y29udGFjdGJ1dHRvbicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRUEnLCAvLyBoYXMgdG8gYmUgYW4gYXR0cmlidXRlIHRvIHdvcmsgd2l0aCBjb3JlIGNzc1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnbmV3Q29udGFjdEJ1dHRvbkN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9uZXdDb250YWN0QnV0dG9uLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBNb2RlbCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm57XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRyZXF1aXJlOiAnbmdNb2RlbCcsXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHIsIG5nTW9kZWwpIHtcblx0XHRcdG5nTW9kZWwuJGZvcm1hdHRlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAodmFsdWUudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmFsdWUuc3BsaXQoJywnKTtcblx0XHRcdH0pO1xuXHRcdFx0bmdNb2RlbC4kcGFyc2Vycy5wdXNoKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB2YWx1ZS5qb2luKCcsJyk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCd0ZWxNb2RlbCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm57XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRyZXF1aXJlOiAnbmdNb2RlbCcsXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHIsIG5nTW9kZWwpIHtcblx0XHRcdG5nTW9kZWwuJGZvcm1hdHRlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9KTtcblx0XHRcdG5nTW9kZWwuJHBhcnNlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQWRkcmVzc0Jvb2snLCBmdW5jdGlvbigpXG57XG5cdHJldHVybiBmdW5jdGlvbiBBZGRyZXNzQm9vayhkYXRhKSB7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXG5cdFx0XHRkaXNwbGF5TmFtZTogJycsXG5cdFx0XHRjb250YWN0czogW10sXG5cdFx0XHRncm91cHM6IGRhdGEuZGF0YS5wcm9wcy5ncm91cHMsXG5cblx0XHRcdGdldENvbnRhY3Q6IGZ1bmN0aW9uKHVpZCkge1xuXHRcdFx0XHRmb3IodmFyIGkgaW4gdGhpcy5jb250YWN0cykge1xuXHRcdFx0XHRcdGlmKHRoaXMuY29udGFjdHNbaV0udWlkKCkgPT09IHVpZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuY29udGFjdHNbaV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXG5cdFx0XHRzaGFyZWRXaXRoOiB7XG5cdFx0XHRcdHVzZXJzOiBbXSxcblx0XHRcdFx0Z3JvdXBzOiBbXVxuXHRcdFx0fVxuXG5cdFx0fSk7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywgZGF0YSk7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXHRcdFx0b3duZXI6IGRhdGEudXJsLnNwbGl0KCcvJykuc2xpY2UoLTMsIC0yKVswXVxuXHRcdH0pO1xuXG5cdFx0dmFyIHNoYXJlcyA9IHRoaXMuZGF0YS5wcm9wcy5pbnZpdGU7XG5cdFx0aWYgKHR5cGVvZiBzaGFyZXMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHNoYXJlcy5sZW5ndGg7IGorKykge1xuXHRcdFx0XHR2YXIgaHJlZiA9IHNoYXJlc1tqXS5ocmVmO1xuXHRcdFx0XHRpZiAoaHJlZi5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgYWNjZXNzID0gc2hhcmVzW2pdLmFjY2Vzcztcblx0XHRcdFx0aWYgKGFjY2Vzcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHZhciByZWFkV3JpdGUgPSAodHlwZW9mIGFjY2Vzcy5yZWFkV3JpdGUgIT09ICd1bmRlZmluZWQnKTtcblxuXHRcdFx0XHRpZiAoaHJlZi5zdGFydHNXaXRoKCdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nKSkge1xuXHRcdFx0XHRcdHRoaXMuc2hhcmVkV2l0aC51c2Vycy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiBocmVmLnN1YnN0cigyNyksXG5cdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogaHJlZi5zdWJzdHIoMjcpLFxuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHJlYWRXcml0ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGhyZWYuc3RhcnRzV2l0aCgncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLycpKSB7XG5cdFx0XHRcdFx0dGhpcy5zaGFyZWRXaXRoLmdyb3Vwcy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiBocmVmLnN1YnN0cigyOCksXG5cdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogaHJlZi5zdWJzdHIoMjgpLFxuXHRcdFx0XHRcdFx0d3JpdGFibGU6IHJlYWRXcml0ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly92YXIgb3duZXIgPSB0aGlzLmRhdGEucHJvcHMub3duZXI7XG5cdFx0Ly9pZiAodHlwZW9mIG93bmVyICE9PSAndW5kZWZpbmVkJyAmJiBvd25lci5sZW5ndGggIT09IDApIHtcblx0XHQvL1x0b3duZXIgPSBvd25lci50cmltKCk7XG5cdFx0Ly9cdGlmIChvd25lci5zdGFydHNXaXRoKCcvcmVtb3RlLnBocC9kYXYvcHJpbmNpcGFscy91c2Vycy8nKSkge1xuXHRcdC8vXHRcdHRoaXMuX3Byb3BlcnRpZXMub3duZXIgPSBvd25lci5zdWJzdHIoMzMpO1xuXHRcdC8vXHR9XG5cdFx0Ly99XG5cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5mYWN0b3J5KCdDb250YWN0JywgZnVuY3Rpb24oJGZpbHRlcikge1xuXHRyZXR1cm4gZnVuY3Rpb24gQ29udGFjdChhZGRyZXNzQm9vaywgdkNhcmQpIHtcblx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLCB7XG5cblx0XHRcdGRhdGE6IHt9LFxuXHRcdFx0cHJvcHM6IHt9LFxuXG5cdFx0XHRhZGRyZXNzQm9va0lkOiBhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSxcblxuXHRcdFx0cmV2OiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnNldFByb3BlcnR5KCdyZXYnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0UHJvcGVydHkoJ3JldicpLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHR1aWQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHZhciBtb2RlbCA9IHRoaXM7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuc2V0UHJvcGVydHkoJ3VpZCcsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHJldHVybiBtb2RlbC5nZXRQcm9wZXJ0eSgndWlkJykudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGRpc3BsYXlOYW1lOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZnVsbE5hbWUoKSB8fCB0aGlzLm9yZygpIHx8ICcnO1xuXHRcdFx0fSxcblxuXHRcdFx0ZnVsbE5hbWU6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHZhciBtb2RlbCA9IHRoaXM7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgnZm4nLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHR2YXIgcHJvcGVydHkgPSBtb2RlbC5nZXRQcm9wZXJ0eSgnZm4nKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRwcm9wZXJ0eSA9IG1vZGVsLmdldFByb3BlcnR5KCduJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS5qb2luKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHRpdGxlOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3RpdGxlJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgndGl0bGUnKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0b3JnOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdvcmcnKTtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdHZhciB2YWwgPSB2YWx1ZTtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSAmJiBBcnJheS5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0dmFsID0gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0XHR2YWxbMF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ29yZycsIHsgdmFsdWU6IHZhbCB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZVswXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGVtYWlsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2VtYWlsJyk7XG5cdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHBob3RvOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0Ly8gc3BsaXRzIGltYWdlIGRhdGEgaW50byBcImRhdGE6aW1hZ2UvanBlZ1wiIGFuZCBiYXNlIDY0IGVuY29kZWQgaW1hZ2Vcblx0XHRcdFx0XHR2YXIgaW1hZ2VEYXRhID0gdmFsdWUuc3BsaXQoJztiYXNlNjQsJyk7XG5cdFx0XHRcdFx0dmFyIGltYWdlVHlwZSA9IGltYWdlRGF0YVswXS5zbGljZSgnZGF0YTonLmxlbmd0aCk7XG5cdFx0XHRcdFx0aWYgKCFpbWFnZVR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aW1hZ2VUeXBlID0gaW1hZ2VUeXBlLnN1YnN0cmluZyg2KS50b1VwcGVyQ2FzZSgpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3Bob3RvJywgeyB2YWx1ZTogaW1hZ2VEYXRhWzFdLCBtZXRhOiB7dHlwZTogW2ltYWdlVHlwZV0sIGVuY29kaW5nOiBbJ2InXX0gfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgncGhvdG8nKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0dmFyIHR5cGUgPSBwcm9wZXJ0eS5tZXRhLnR5cGU7XG5cdFx0XHRcdFx0XHRpZiAoYW5ndWxhci5pc0FycmF5KHR5cGUpKSB7XG5cdFx0XHRcdFx0XHRcdHR5cGUgPSB0eXBlWzBdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCF0eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSB7XG5cdFx0XHRcdFx0XHRcdHR5cGUgPSAnaW1hZ2UvJyArIHR5cGUudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiAnZGF0YTonICsgdHlwZSArICc7YmFzZTY0LCcgKyBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGNhdGVnb3JpZXM6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgnY2F0ZWdvcmllcycsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSAmJiBwcm9wZXJ0eS52YWx1ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuc3BsaXQoJywnKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0Z2V0UHJvcGVydHk6IGZ1bmN0aW9uKG5hbWUpIHtcblx0XHRcdFx0aWYgKHRoaXMucHJvcHNbbmFtZV0pIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5wcm9wc1tuYW1lXVswXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkUHJvcGVydHk6IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcblx0XHRcdFx0ZGF0YSA9IGFuZ3VsYXIuY29weShkYXRhKTtcblx0XHRcdFx0aWYoIXRoaXMucHJvcHNbbmFtZV0pIHtcblx0XHRcdFx0XHR0aGlzLnByb3BzW25hbWVdID0gW107XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIGlkeCA9IHRoaXMucHJvcHNbbmFtZV0ubGVuZ3RoO1xuXHRcdFx0XHR0aGlzLnByb3BzW25hbWVdW2lkeF0gPSBkYXRhO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHRcdHJldHVybiBpZHg7XG5cdFx0XHR9LFxuXHRcdFx0c2V0UHJvcGVydHk6IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcblx0XHRcdFx0aWYoIXRoaXMucHJvcHNbbmFtZV0pIHtcblx0XHRcdFx0XHR0aGlzLnByb3BzW25hbWVdID0gW107XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXVswXSA9IGRhdGE7XG5cblx0XHRcdFx0Ly8ga2VlcCB2Q2FyZCBpbiBzeW5jXG5cdFx0XHRcdHRoaXMuZGF0YS5hZGRyZXNzRGF0YSA9ICRmaWx0ZXIoJ0pTT04ydkNhcmQnKSh0aGlzLnByb3BzKTtcblx0XHRcdH0sXG5cdFx0XHRyZW1vdmVQcm9wZXJ0eTogZnVuY3Rpb24gKG5hbWUsIHByb3ApIHtcblx0XHRcdFx0YW5ndWxhci5jb3B5KF8ud2l0aG91dCh0aGlzLnByb3BzW25hbWVdLCBwcm9wKSwgdGhpcy5wcm9wc1tuYW1lXSk7XG5cdFx0XHRcdHRoaXMuZGF0YS5hZGRyZXNzRGF0YSA9ICRmaWx0ZXIoJ0pTT04ydkNhcmQnKSh0aGlzLnByb3BzKTtcblx0XHRcdH0sXG5cdFx0XHRzZXRFVGFnOiBmdW5jdGlvbihldGFnKSB7XG5cdFx0XHRcdHRoaXMuZGF0YS5ldGFnID0gZXRhZztcblx0XHRcdH0sXG5cdFx0XHRzZXRVcmw6IGZ1bmN0aW9uKGFkZHJlc3NCb29rLCB1aWQpIHtcblx0XHRcdFx0dGhpcy5kYXRhLnVybCA9IGFkZHJlc3NCb29rLnVybCArIHVpZCArICcudmNmJztcblx0XHRcdH0sXG5cblx0XHRcdHN5bmNWQ2FyZDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXG5cdFx0XHRtYXRjaGVzOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKHBhdHRlcm4pIHx8IHBhdHRlcm4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0dmFyIG1hdGNoaW5nUHJvcHMgPSBbJ2ZuJywgJ3RpdGxlJywgJ29yZycsICdlbWFpbCcsICduaWNrbmFtZScsICdub3RlJywgJ3VybCcsICdjbG91ZCcsICdhZHInLCAnaW1wcCcsICd0ZWwnXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BOYW1lKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsLnByb3BzW3Byb3BOYW1lXSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnByb3BzW3Byb3BOYW1lXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRcdGlmICghcHJvcGVydHkudmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKF8uaXNTdHJpbmcocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpICE9PSAtMTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoXy5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS5maWx0ZXIoZnVuY3Rpb24odikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHYudG9Mb3dlckNhc2UoKS5pbmRleE9mKHBhdHRlcm4udG9Mb3dlckNhc2UoKSkgIT09IC0xO1xuXHRcdFx0XHRcdFx0XHRcdH0pLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSkubGVuZ3RoID4gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIG1hdGNoaW5nUHJvcHMubGVuZ3RoID4gMDtcblx0XHRcdH1cblxuXHRcdH0pO1xuXG5cdFx0aWYoYW5ndWxhci5pc0RlZmluZWQodkNhcmQpKSB7XG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLmRhdGEsIHZDYXJkKTtcblx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMucHJvcHMsICRmaWx0ZXIoJ3ZDYXJkMkpTT04nKSh0aGlzLmRhdGEuYWRkcmVzc0RhdGEpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YW5ndWxhci5leHRlbmQodGhpcy5wcm9wcywge1xuXHRcdFx0XHR2ZXJzaW9uOiBbe3ZhbHVlOiAnMy4wJ31dLFxuXHRcdFx0XHRmbjogW3t2YWx1ZTogJyd9XVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0fVxuXG5cdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnY2F0ZWdvcmllcycpO1xuXHRcdGlmKCFwcm9wZXJ0eSkge1xuXHRcdFx0dGhpcy5jYXRlZ29yaWVzKCcnKTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQWRkcmVzc0Jvb2tTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50LCBEYXZTZXJ2aWNlLCBTZXR0aW5nc1NlcnZpY2UsIEFkZHJlc3NCb29rLCAkcSkge1xuXG5cdHZhciBhZGRyZXNzQm9va3MgPSBbXTtcblx0dmFyIGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXG5cdHZhciBsb2FkQWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGFkZHJlc3NCb29rcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihhZGRyZXNzQm9va3MpO1xuXHRcdH1cblx0XHRpZiAoXy5pc1VuZGVmaW5lZChsb2FkUHJvbWlzZSkpIHtcblx0XHRcdGxvYWRQcm9taXNlID0gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0bG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGFkZHJlc3NCb29rcyA9IGFjY291bnQuYWRkcmVzc0Jvb2tzLm1hcChmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9hZFByb21pc2U7XG5cdH07XG5cblx0cmV0dXJuIHtcblx0XHRnZXRBbGw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGxvYWRBbGwoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2tzO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGdldEdyb3VwczogZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcy5tYXAoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5ncm91cHM7XG5cdFx0XHRcdH0pLnJlZHVjZShmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGEuY29uY2F0KGIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRnZXREZWZhdWx0QWRkcmVzc0Jvb2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rc1swXTtcblx0XHR9LFxuXG5cdFx0Z2V0QWRkcmVzc0Jvb2s6IGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5nZXRBZGRyZXNzQm9vayh7ZGlzcGxheU5hbWU6ZGlzcGxheU5hbWUsIHVybDphY2NvdW50LmhvbWVVcmx9KS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2sgPSBuZXcgQWRkcmVzc0Jvb2soe1xuXHRcdFx0XHRcdFx0dXJsOiBhZGRyZXNzQm9va1swXS5ocmVmLFxuXHRcdFx0XHRcdFx0ZGF0YTogYWRkcmVzc0Jvb2tbMF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSA9IGRpc3BsYXlOYW1lO1xuXHRcdFx0XHRcdHJldHVybiBhZGRyZXNzQm9vaztcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Y3JlYXRlOiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWRkcmVzc0Jvb2soe2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0ZGVsZXRlOiBmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5kZWxldGVBZGRyZXNzQm9vayhhZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR2YXIgaW5kZXggPSBhZGRyZXNzQm9va3MuaW5kZXhPZihhZGRyZXNzQm9vayk7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2tzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdHJlbmFtZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5yZW5hbWVBZGRyZXNzQm9vayhhZGRyZXNzQm9vaywge2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcy5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5kaXNwbGF5TmFtZSA9PT0gZGlzcGxheU5hbWU7XG5cdFx0XHRcdH0pWzBdO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdHN5bmM6IGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50LnN5bmNBZGRyZXNzQm9vayhhZGRyZXNzQm9vayk7XG5cdFx0fSxcblxuXHRcdHNoYXJlOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgc2hhcmVUeXBlLCBzaGFyZVdpdGgsIHdyaXRhYmxlLCBleGlzdGluZ1NoYXJlKSB7XG5cdFx0XHR2YXIgeG1sRG9jID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlRG9jdW1lbnQoJycsICcnLCBudWxsKTtcblx0XHRcdHZhciBvU2hhcmUgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzaGFyZScpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6ZCcsICdEQVY6Jyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpvJywgJ2h0dHA6Ly9vd25jbG91ZC5vcmcvbnMnKTtcblx0XHRcdHhtbERvYy5hcHBlbmRDaGlsZChvU2hhcmUpO1xuXG5cdFx0XHR2YXIgb1NldCA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNldCcpO1xuXHRcdFx0b1NoYXJlLmFwcGVuZENoaWxkKG9TZXQpO1xuXG5cdFx0XHR2YXIgZEhyZWYgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnZDpocmVmJyk7XG5cdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJztcblx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nO1xuXHRcdFx0fVxuXHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgKz0gc2hhcmVXaXRoO1xuXHRcdFx0b1NldC5hcHBlbmRDaGlsZChkSHJlZik7XG5cblx0XHRcdHZhciBvU3VtbWFyeSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnN1bW1hcnknKTtcblx0XHRcdG9TdW1tYXJ5LnRleHRDb250ZW50ID0gdCgnY29udGFjdHMnLCAne2FkZHJlc3Nib29rfSBzaGFyZWQgYnkge293bmVyfScsIHtcblx0XHRcdFx0YWRkcmVzc2Jvb2s6IGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRvd25lcjogYWRkcmVzc0Jvb2sub3duZXJcblx0XHRcdH0pO1xuXHRcdFx0b1NldC5hcHBlbmRDaGlsZChvU3VtbWFyeSk7XG5cblx0XHRcdGlmICh3cml0YWJsZSkge1xuXHRcdFx0XHR2YXIgb1JXID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286cmVhZC13cml0ZScpO1xuXHRcdFx0XHRvU2V0LmFwcGVuZENoaWxkKG9SVyk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBib2R5ID0gb1NoYXJlLm91dGVySFRNTDtcblxuXHRcdFx0cmV0dXJuIERhdkNsaWVudC54aHIuc2VuZChcblx0XHRcdFx0ZGF2LnJlcXVlc3QuYmFzaWMoe21ldGhvZDogJ1BPU1QnLCBkYXRhOiBib2R5fSksXG5cdFx0XHRcdGFkZHJlc3NCb29rLnVybFxuXHRcdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwMCkge1xuXHRcdFx0XHRcdGlmICghZXhpc3RpbmdTaGFyZSkge1xuXHRcdFx0XHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdHdyaXRhYmxlOiB3cml0YWJsZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHR3cml0YWJsZTogd3JpdGFibGVcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH0sXG5cblx0XHR1bnNoYXJlOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgc2hhcmVUeXBlLCBzaGFyZVdpdGgpIHtcblx0XHRcdHZhciB4bWxEb2MgPSBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVEb2N1bWVudCgnJywgJycsIG51bGwpO1xuXHRcdFx0dmFyIG9TaGFyZSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNoYXJlJyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpkJywgJ0RBVjonKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOm8nLCAnaHR0cDovL293bmNsb3VkLm9yZy9ucycpO1xuXHRcdFx0eG1sRG9jLmFwcGVuZENoaWxkKG9TaGFyZSk7XG5cblx0XHRcdHZhciBvUmVtb3ZlID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286cmVtb3ZlJyk7XG5cdFx0XHRvU2hhcmUuYXBwZW5kQ2hpbGQob1JlbW92ZSk7XG5cblx0XHRcdHZhciBkSHJlZiA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdkOmhyZWYnKTtcblx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nO1xuXHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLyc7XG5cdFx0XHR9XG5cdFx0XHRkSHJlZi50ZXh0Q29udGVudCArPSBzaGFyZVdpdGg7XG5cdFx0XHRvUmVtb3ZlLmFwcGVuZENoaWxkKGRIcmVmKTtcblx0XHRcdHZhciBib2R5ID0gb1NoYXJlLm91dGVySFRNTDtcblxuXG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50Lnhoci5zZW5kKFxuXHRcdFx0XHRkYXYucmVxdWVzdC5iYXNpYyh7bWV0aG9kOiAnUE9TVCcsIGRhdGE6IGJvZHl9KSxcblx0XHRcdFx0YWRkcmVzc0Jvb2sudXJsXG5cdFx0XHQpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzID0gYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycy5maWx0ZXIoZnVuY3Rpb24odXNlcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdXNlci5pZCAhPT0gc2hhcmVXaXRoO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzID0gYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC5ncm91cHMuZmlsdGVyKGZ1bmN0aW9uKGdyb3Vwcykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ3JvdXBzLmlkICE9PSBzaGFyZVdpdGg7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly90b2RvIC0gcmVtb3ZlIGVudHJ5IGZyb20gYWRkcmVzc2Jvb2sgb2JqZWN0XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH1cblxuXG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdDb250YWN0U2VydmljZScsIGZ1bmN0aW9uKERhdkNsaWVudCwgQWRkcmVzc0Jvb2tTZXJ2aWNlLCBDb250YWN0LCAkcSwgQ2FjaGVGYWN0b3J5LCB1dWlkNCkge1xuXG5cdHZhciBjYWNoZUZpbGxlZCA9IGZhbHNlO1xuXG5cdHZhciBjb250YWN0cyA9IENhY2hlRmFjdG9yeSgnY29udGFjdHMnKTtcblxuXHR2YXIgb2JzZXJ2ZXJDYWxsYmFja3MgPSBbXTtcblxuXHR2YXIgbG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUsIHVpZCkge1xuXHRcdHZhciBldiA9IHtcblx0XHRcdGV2ZW50OiBldmVudE5hbWUsXG5cdFx0XHR1aWQ6IHVpZCxcblx0XHRcdGNvbnRhY3RzOiBjb250YWN0cy52YWx1ZXMoKVxuXHRcdH07XG5cdFx0YW5ndWxhci5mb3JFYWNoKG9ic2VydmVyQ2FsbGJhY2tzLCBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2soZXYpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZmlsbENhY2hlID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobG9hZFByb21pc2UpKSB7XG5cdFx0XHRsb2FkUHJvbWlzZSA9IEFkZHJlc3NCb29rU2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uIChlbmFibGVkQWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHZhciBwcm9taXNlcyA9IFtdO1xuXHRcdFx0XHRlbmFibGVkQWRkcmVzc0Jvb2tzLmZvckVhY2goZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0cHJvbWlzZXMucHVzaChcblx0XHRcdFx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5zeW5jKGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uIChhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBpIGluIGFkZHJlc3NCb29rLm9iamVjdHMpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYWRkcmVzc0Jvb2sub2JqZWN0c1tpXS5hZGRyZXNzRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGNvbnRhY3QgPSBuZXcgQ29udGFjdChhZGRyZXNzQm9vaywgYWRkcmVzc0Jvb2sub2JqZWN0c1tpXSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb250YWN0cy5wdXQoY29udGFjdC51aWQoKSwgY29udGFjdCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIGN1c3RvbSBjb25zb2xlXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnSW52YWxpZCBjb250YWN0IHJlY2VpdmVkOiAnICsgYWRkcmVzc0Jvb2sub2JqZWN0c1tpXS51cmwpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuICRxLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0Y2FjaGVGaWxsZWQgPSB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9hZFByb21pc2U7XG5cdH07XG5cblx0dGhpcy5nZXRBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRpZihjYWNoZUZpbGxlZCA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGxDYWNoZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb250YWN0cy52YWx1ZXMoKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihjb250YWN0cy52YWx1ZXMoKSk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0R3JvdXBzID0gZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRcdHJldHVybiBfLnVuaXEoY29udGFjdHMubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmNhdGVnb3JpZXMoKTtcblx0XHRcdH0pLnJlZHVjZShmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRcdHJldHVybiBhLmNvbmNhdChiKTtcblx0XHRcdH0sIFtdKS5zb3J0KCksIHRydWUpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZ2V0QnlJZCA9IGZ1bmN0aW9uKHVpZCkge1xuXHRcdGlmKGNhY2hlRmlsbGVkID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsbENhY2hlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRhY3RzLmdldCh1aWQpO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAkcS53aGVuKGNvbnRhY3RzLmdldCh1aWQpKTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5jcmVhdGUgPSBmdW5jdGlvbihuZXdDb250YWN0LCBhZGRyZXNzQm9vaywgdWlkKSB7XG5cdFx0YWRkcmVzc0Jvb2sgPSBhZGRyZXNzQm9vayB8fCBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0RGVmYXVsdEFkZHJlc3NCb29rKCk7XG5cdFx0bmV3Q29udGFjdCA9IG5ld0NvbnRhY3QgfHwgbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2spO1xuXHRcdHZhciBuZXdVaWQgPSAnJztcblx0XHRpZih1dWlkNC52YWxpZGF0ZSh1aWQpKSB7XG5cdFx0XHRuZXdVaWQgPSB1aWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ld1VpZCA9IHV1aWQ0LmdlbmVyYXRlKCk7XG5cdFx0fVxuXHRcdG5ld0NvbnRhY3QudWlkKG5ld1VpZCk7XG5cdFx0bmV3Q29udGFjdC5zZXRVcmwoYWRkcmVzc0Jvb2ssIG5ld1VpZCk7XG5cdFx0bmV3Q29udGFjdC5hZGRyZXNzQm9va0lkID0gYWRkcmVzc0Jvb2suZGlzcGxheU5hbWU7XG5cblx0XHRyZXR1cm4gRGF2Q2xpZW50LmNyZWF0ZUNhcmQoXG5cdFx0XHRhZGRyZXNzQm9vayxcblx0XHRcdHtcblx0XHRcdFx0ZGF0YTogbmV3Q29udGFjdC5kYXRhLmFkZHJlc3NEYXRhLFxuXHRcdFx0XHRmaWxlbmFtZTogbmV3VWlkICsgJy52Y2YnXG5cdFx0XHR9XG5cdFx0KS50aGVuKGZ1bmN0aW9uKHhocikge1xuXHRcdFx0bmV3Q29udGFjdC5zZXRFVGFnKHhoci5nZXRSZXNwb25zZUhlYWRlcignRVRhZycpKTtcblx0XHRcdGNvbnRhY3RzLnB1dChuZXdVaWQsIG5ld0NvbnRhY3QpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdjcmVhdGUnLCBuZXdVaWQpO1xuXHRcdFx0cmV0dXJuIG5ld0NvbnRhY3Q7XG5cdFx0fSkuY2F0Y2goZnVuY3Rpb24oZSkge1xuXHRcdFx0T0MuTm90aWZpY2F0aW9uLnNob3dUZW1wb3JhcnkodCgnY29udGFjdHMnLCAnQ29udGFjdCBjb3VsZCBub3QgYmUgY3JlYXRlZC4nKSk7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5pbXBvcnQgPSBmdW5jdGlvbihkYXRhLCB0eXBlLCBhZGRyZXNzQm9vaywgcHJvZ3Jlc3NDYWxsYmFjaykge1xuXHRcdGFkZHJlc3NCb29rID0gYWRkcmVzc0Jvb2sgfHwgQWRkcmVzc0Jvb2tTZXJ2aWNlLmdldERlZmF1bHRBZGRyZXNzQm9vaygpO1xuXG5cdFx0dmFyIHJlZ2V4cCA9IC9CRUdJTjpWQ0FSRFtcXHNcXFNdKj9FTkQ6VkNBUkQvbWdpO1xuXHRcdHZhciBzaW5nbGVWQ2FyZHMgPSBkYXRhLm1hdGNoKHJlZ2V4cCk7XG5cblx0XHRpZiAoIXNpbmdsZVZDYXJkcykge1xuXHRcdFx0T0MuTm90aWZpY2F0aW9uLnNob3dUZW1wb3JhcnkodCgnY29udGFjdHMnLCAnTm8gY29udGFjdHMgaW4gZmlsZS4gT25seSBWQ2FyZCBmaWxlcyBhcmUgYWxsb3dlZC4nKSk7XG5cdFx0XHRpZiAocHJvZ3Jlc3NDYWxsYmFjaykge1xuXHRcdFx0XHRwcm9ncmVzc0NhbGxiYWNrKDEpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR2YXIgbnVtID0gMTtcblx0XHRmb3IodmFyIGkgaW4gc2luZ2xlVkNhcmRzKSB7XG5cdFx0XHR2YXIgbmV3Q29udGFjdCA9IG5ldyBDb250YWN0KGFkZHJlc3NCb29rLCB7YWRkcmVzc0RhdGE6IHNpbmdsZVZDYXJkc1tpXX0pO1xuXHRcdFx0dGhpcy5jcmVhdGUobmV3Q29udGFjdCwgYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIFVwZGF0ZSB0aGUgcHJvZ3Jlc3MgaW5kaWNhdG9yXG5cdFx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSBwcm9ncmVzc0NhbGxiYWNrKG51bS9zaW5nbGVWQ2FyZHMubGVuZ3RoKTtcblx0XHRcdFx0bnVtKys7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5tb3ZlQ29udGFjdCA9IGZ1bmN0aW9uIChjb250YWN0LCBhZGRyZXNzYm9vaykge1xuXHRcdGlmIChjb250YWN0LmFkZHJlc3NCb29rSWQgPT09IGFkZHJlc3Nib29rLmRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRhY3Quc3luY1ZDYXJkKCk7XG5cdFx0dmFyIGNsb25lID0gYW5ndWxhci5jb3B5KGNvbnRhY3QpO1xuXHRcdHZhciB1aWQgPSBjb250YWN0LnVpZCgpO1xuXG5cdFx0Ly8gZGVsZXRlIHRoZSBvbGQgb25lIGJlZm9yZSB0byBhdm9pZCBjb25mbGljdFxuXHRcdHRoaXMuZGVsZXRlKGNvbnRhY3QpO1xuXG5cdFx0Ly8gY3JlYXRlIHRoZSBjb250YWN0IGluIHRoZSBuZXcgdGFyZ2V0IGFkZHJlc3Nib29rXG5cdFx0dGhpcy5jcmVhdGUoY2xvbmUsIGFkZHJlc3Nib29rLCB1aWQpO1xuXHR9O1xuXG5cdHRoaXMudXBkYXRlID0gZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdC8vIHVwZGF0ZSByZXYgZmllbGRcblx0XHRjb250YWN0LnJldihuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkpO1xuXG5cdFx0Y29udGFjdC5zeW5jVkNhcmQoKTtcblxuXHRcdC8vIHVwZGF0ZSBjb250YWN0IG9uIHNlcnZlclxuXHRcdHJldHVybiBEYXZDbGllbnQudXBkYXRlQ2FyZChjb250YWN0LmRhdGEsIHtqc29uOiB0cnVlfSkudGhlbihmdW5jdGlvbih4aHIpIHtcblx0XHRcdHZhciBuZXdFdGFnID0geGhyLmdldFJlc3BvbnNlSGVhZGVyKCdFVGFnJyk7XG5cdFx0XHRjb250YWN0LnNldEVUYWcobmV3RXRhZyk7XG5cdFx0XHRub3RpZnlPYnNlcnZlcnMoJ3VwZGF0ZScsIGNvbnRhY3QudWlkKCkpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZGVsZXRlID0gZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdC8vIGRlbGV0ZSBjb250YWN0IGZyb20gc2VydmVyXG5cdFx0cmV0dXJuIERhdkNsaWVudC5kZWxldGVDYXJkKGNvbnRhY3QuZGF0YSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdGNvbnRhY3RzLnJlbW92ZShjb250YWN0LnVpZCgpKTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnZGVsZXRlJywgY29udGFjdC51aWQoKSk7XG5cdFx0fSk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgnRGF2Q2xpZW50JywgZnVuY3Rpb24oKSB7XG5cdHZhciB4aHIgPSBuZXcgZGF2LnRyYW5zcG9ydC5CYXNpYyhcblx0XHRuZXcgZGF2LkNyZWRlbnRpYWxzKClcblx0KTtcblx0cmV0dXJuIG5ldyBkYXYuQ2xpZW50KHhocik7XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgnRGF2U2VydmljZScsIGZ1bmN0aW9uKERhdkNsaWVudCkge1xuXHRyZXR1cm4gRGF2Q2xpZW50LmNyZWF0ZUFjY291bnQoe1xuXHRcdHNlcnZlcjogT0MubGlua1RvUmVtb3RlKCdkYXYvYWRkcmVzc2Jvb2tzJyksXG5cdFx0YWNjb3VudFR5cGU6ICdjYXJkZGF2Jyxcblx0XHR1c2VQcm92aWRlZFBhdGg6IHRydWVcblx0fSk7XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgnU2VhcmNoU2VydmljZScsIGZ1bmN0aW9uKCkge1xuXHR2YXIgc2VhcmNoVGVybSA9ICcnO1xuXG5cdHZhciBvYnNlcnZlckNhbGxiYWNrcyA9IFtdO1xuXG5cdHRoaXMucmVnaXN0ZXJPYnNlcnZlckNhbGxiYWNrID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRvYnNlcnZlckNhbGxiYWNrcy5wdXNoKGNhbGxiYWNrKTtcblx0fTtcblxuXHR2YXIgbm90aWZ5T2JzZXJ2ZXJzID0gZnVuY3Rpb24oZXZlbnROYW1lKSB7XG5cdFx0dmFyIGV2ID0ge1xuXHRcdFx0ZXZlbnQ6ZXZlbnROYW1lLFxuXHRcdFx0c2VhcmNoVGVybTpzZWFyY2hUZXJtXG5cdFx0fTtcblx0XHRhbmd1bGFyLmZvckVhY2gob2JzZXJ2ZXJDYWxsYmFja3MsIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHRjYWxsYmFjayhldik7XG5cdFx0fSk7XG5cdH07XG5cblx0dmFyIFNlYXJjaFByb3h5ID0ge1xuXHRcdGF0dGFjaDogZnVuY3Rpb24oc2VhcmNoKSB7XG5cdFx0XHRzZWFyY2guc2V0RmlsdGVyKCdjb250YWN0cycsIHRoaXMuZmlsdGVyUHJveHkpO1xuXHRcdH0sXG5cdFx0ZmlsdGVyUHJveHk6IGZ1bmN0aW9uKHF1ZXJ5KSB7XG5cdFx0XHRzZWFyY2hUZXJtID0gcXVlcnk7XG5cdFx0XHRub3RpZnlPYnNlcnZlcnMoJ2NoYW5nZVNlYXJjaCcpO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLmdldFNlYXJjaFRlcm0gPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gc2VhcmNoVGVybTtcblx0fTtcblxuXHR0aGlzLmNsZWFuU2VhcmNoID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKCQoJy5zZWFyY2hib3gnKSkpIHtcblx0XHRcdCQoJy5zZWFyY2hib3gnKVswXS5yZXNldCgpO1xuXHRcdH1cblx0XHRzZWFyY2hUZXJtID0gJyc7XG5cdH07XG5cblx0aWYgKCFfLmlzVW5kZWZpbmVkKE9DLlBsdWdpbnMpKSB7XG5cdFx0T0MuUGx1Z2lucy5yZWdpc3RlcignT0NBLlNlYXJjaCcsIFNlYXJjaFByb3h5KTtcblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoT0NBLlNlYXJjaCkpIHtcblx0XHRcdE9DLlNlYXJjaCA9IG5ldyBPQ0EuU2VhcmNoKCQoJyNzZWFyY2hib3gnKSwgJCgnI3NlYXJjaHJlc3VsdHMnKSk7XG5cdFx0XHQkKCcjc2VhcmNoYm94Jykuc2hvdygpO1xuXHRcdH1cblx0fVxuXG5cdGlmICghXy5pc1VuZGVmaW5lZCgkKCcuc2VhcmNoYm94JykpKSB7XG5cdFx0JCgnLnNlYXJjaGJveCcpWzBdLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZnVuY3Rpb24oZSkge1xuXHRcdFx0aWYoZS5rZXlDb2RlID09PSAxMykge1xuXHRcdFx0XHRub3RpZnlPYnNlcnZlcnMoJ3N1Ym1pdFNlYXJjaCcpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgnU2V0dGluZ3NTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdHZhciBzZXR0aW5ncyA9IHtcblx0XHRhZGRyZXNzQm9va3M6IFtcblx0XHRcdCd0ZXN0QWRkcidcblx0XHRdXG5cdH07XG5cblx0dGhpcy5zZXQgPSBmdW5jdGlvbihrZXksIHZhbHVlKSB7XG5cdFx0c2V0dGluZ3Nba2V5XSA9IHZhbHVlO1xuXHR9O1xuXG5cdHRoaXMuZ2V0ID0gZnVuY3Rpb24oa2V5KSB7XG5cdFx0cmV0dXJuIHNldHRpbmdzW2tleV07XG5cdH07XG5cblx0dGhpcy5nZXRBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gc2V0dGluZ3M7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uc2VydmljZSgndkNhcmRQcm9wZXJ0aWVzU2VydmljZScsIGZ1bmN0aW9uKCkge1xuXHQvKipcblx0ICogbWFwIHZDYXJkIGF0dHJpYnV0ZXMgdG8gaW50ZXJuYWwgYXR0cmlidXRlc1xuXHQgKlxuXHQgKiBwcm9wTmFtZToge1xuXHQgKiBcdFx0bXVsdGlwbGU6IFtCb29sZWFuXSwgLy8gaXMgdGhpcyBwcm9wIGFsbG93ZWQgbW9yZSB0aGFuIG9uY2U/IChkZWZhdWx0ID0gZmFsc2UpXG5cdCAqIFx0XHRyZWFkYWJsZU5hbWU6IFtTdHJpbmddLCAvLyBpbnRlcm5hdGlvbmFsaXplZCByZWFkYWJsZSBuYW1lIG9mIHByb3Bcblx0ICogXHRcdHRlbXBsYXRlOiBbU3RyaW5nXSwgLy8gdGVtcGxhdGUgbmFtZSBmb3VuZCBpbiAvdGVtcGxhdGVzL2RldGFpbEl0ZW1zXG5cdCAqIFx0XHRbLi4uXSAvLyBvcHRpb25hbCBhZGRpdGlvbmFsIGluZm9ybWF0aW9uIHdoaWNoIG1pZ2h0IGdldCB1c2VkIGJ5IHRoZSB0ZW1wbGF0ZVxuXHQgKiB9XG5cdCAqL1xuXHR0aGlzLnZDYXJkTWV0YSA9IHtcblx0XHRuaWNrbmFtZToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdOaWNrbmFtZScpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0J1xuXHRcdH0sXG5cdFx0bjoge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdEZXRhaWxlZCBuYW1lJyksXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnLCAnJywgJycsICcnLCAnJ11cblx0XHRcdH0sXG5cdFx0XHR0ZW1wbGF0ZTogJ24nXG5cdFx0fSxcblx0XHRub3RlOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ05vdGVzJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHRhcmVhJ1xuXHRcdH0sXG5cdFx0dXJsOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnV2Vic2l0ZScpLFxuXHRcdFx0dGVtcGxhdGU6ICd1cmwnXG5cdFx0fSxcblx0XHRjbG91ZDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZlZGVyYXRlZCBDbG91ZCBJRCcpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXHRcdH0sXG5cdFx0YWRyOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnQWRkcmVzcycpLFxuXHRcdFx0dGVtcGxhdGU6ICdhZHInLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJywgJycsICcnLCAnJywgJycsICcnLCAnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdGNhdGVnb3JpZXM6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnR3JvdXBzJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2dyb3Vwcydcblx0XHR9LFxuXHRcdGJkYXk6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnQmlydGhkYXknKSxcblx0XHRcdHRlbXBsYXRlOiAnZGF0ZSdcblx0XHR9LFxuXHRcdGFubml2ZXJzYXJ5OiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0Fubml2ZXJzYXJ5JyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2RhdGUnXG5cdFx0fSxcblx0XHRkZWF0aGRhdGU6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRGF0ZSBvZiBkZWF0aCcpLFxuXHRcdFx0dGVtcGxhdGU6ICdkYXRlJ1xuXHRcdH0sXG5cdFx0ZW1haWw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdFbWFpbCcpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTonJyxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0aW1wcDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0luc3RhbnQgbWVzc2FnaW5nJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdHRlbDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ1Bob25lJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RlbCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUsVk9JQ0UnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUsVk9JQ0UnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLLFZPSUNFJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnQ0VMTCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ01vYmlsZScpfSxcblx0XHRcdFx0e2lkOiAnRkFYJywgbmFtZTogdCgnY29udGFjdHMnLCAnRmF4Jyl9LFxuXHRcdFx0XHR7aWQ6ICdIT01FLEZBWCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZheCBob21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLLEZBWCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZheCB3b3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdQQUdFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1BhZ2VyJyl9LFxuXHRcdFx0XHR7aWQ6ICdWT0lDRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1ZvaWNlJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHQnWC1TT0NJQUxQUk9GSUxFJzoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ1NvY2lhbCBuZXR3b3JrJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydmYWNlYm9vayddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnRkFDRUJPT0snLCBuYW1lOiAnRmFjZWJvb2snfSxcblx0XHRcdFx0e2lkOiAnVFdJVFRFUicsIG5hbWU6ICdUd2l0dGVyJ31cblx0XHRcdF1cblxuXHRcdH1cblx0fTtcblxuXHR0aGlzLmZpZWxkT3JkZXIgPSBbXG5cdFx0J29yZycsXG5cdFx0J3RpdGxlJyxcblx0XHQndGVsJyxcblx0XHQnZW1haWwnLFxuXHRcdCdhZHInLFxuXHRcdCdpbXBwJyxcblx0XHQnbmljaycsXG5cdFx0J2JkYXknLFxuXHRcdCdhbm5pdmVyc2FyeScsXG5cdFx0J2RlYXRoZGF0ZScsXG5cdFx0J3VybCcsXG5cdFx0J1gtU09DSUFMUFJPRklMRScsXG5cdFx0J25vdGUnLFxuXHRcdCdjYXRlZ29yaWVzJyxcblx0XHQncm9sZSdcblx0XTtcblxuXHR0aGlzLmZpZWxkRGVmaW5pdGlvbnMgPSBbXTtcblx0Zm9yICh2YXIgcHJvcCBpbiB0aGlzLnZDYXJkTWV0YSkge1xuXHRcdHRoaXMuZmllbGREZWZpbml0aW9ucy5wdXNoKHtpZDogcHJvcCwgbmFtZTogdGhpcy52Q2FyZE1ldGFbcHJvcF0ucmVhZGFibGVOYW1lLCBtdWx0aXBsZTogISF0aGlzLnZDYXJkTWV0YVtwcm9wXS5tdWx0aXBsZX0pO1xuXHR9XG5cblx0dGhpcy5mYWxsYmFja01ldGEgPSBmdW5jdGlvbihwcm9wZXJ0eSkge1xuXHRcdGZ1bmN0aW9uIGNhcGl0YWxpemUoc3RyaW5nKSB7IHJldHVybiBzdHJpbmcuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBzdHJpbmcuc2xpY2UoMSk7IH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogJ3Vua25vd24tJyArIHByb3BlcnR5LFxuXHRcdFx0cmVhZGFibGVOYW1lOiBjYXBpdGFsaXplKHByb3BlcnR5KSxcblx0XHRcdHRlbXBsYXRlOiAnaGlkZGVuJyxcblx0XHRcdG5lY2Vzc2l0eTogJ29wdGlvbmFsJ1xuXHRcdH07XG5cdH07XG5cblx0dGhpcy5nZXRNZXRhID0gZnVuY3Rpb24ocHJvcGVydHkpIHtcblx0XHRyZXR1cm4gdGhpcy52Q2FyZE1ldGFbcHJvcGVydHldIHx8IHRoaXMuZmFsbGJhY2tNZXRhKHByb3BlcnR5KTtcblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignSlNPTjJ2Q2FyZCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gdkNhcmQuZ2VuZXJhdGUoaW5wdXQpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignY29udGFjdENvbG9yJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdC8vIENoZWNrIGlmIGNvcmUgaGFzIHRoZSBuZXcgY29sb3IgZ2VuZXJhdG9yXG5cdFx0aWYodHlwZW9mIGlucHV0LnRvSHNsID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHR2YXIgaHNsID0gaW5wdXQudG9Ic2woKTtcblx0XHRcdHJldHVybiAnaHNsKCcraHNsWzBdKycsICcraHNsWzFdKyclLCAnK2hzbFsyXSsnJSknO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBJZiBub3QsIHdlIHVzZSB0aGUgb2xkIG9uZVxuXHRcdFx0LyogZ2xvYmFsIG1kNSAqL1xuXHRcdFx0dmFyIGhhc2ggPSBtZDUoaW5wdXQpLnN1YnN0cmluZygwLCA0KSxcblx0XHRcdFx0bWF4UmFuZ2UgPSBwYXJzZUludCgnZmZmZicsIDE2KSxcblx0XHRcdFx0aHVlID0gcGFyc2VJbnQoaGFzaCwgMTYpIC8gbWF4UmFuZ2UgKiAyNTY7XG5cdFx0XHRyZXR1cm4gJ2hzbCgnICsgaHVlICsgJywgOTAlLCA2NSUpJztcblx0XHR9XG5cdH07XG59KTsiLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignY29udGFjdEdyb3VwRmlsdGVyJywgZnVuY3Rpb24oKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0cmV0dXJuIGZ1bmN0aW9uIChjb250YWN0cywgZ3JvdXApIHtcblx0XHRpZiAodHlwZW9mIGNvbnRhY3RzID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGNvbnRhY3RzO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGdyb3VwID09PSAndW5kZWZpbmVkJyB8fCBncm91cC50b0xvd2VyQ2FzZSgpID09PSB0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRyZXR1cm4gY29udGFjdHM7XG5cdFx0fVxuXHRcdHZhciBmaWx0ZXIgPSBbXTtcblx0XHRpZiAoY29udGFjdHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBjb250YWN0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAoZ3JvdXAudG9Mb3dlckNhc2UoKSA9PT0gdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKS50b0xvd2VyQ2FzZSgpKSB7XG5cdFx0XHRcdFx0aWYgKGNvbnRhY3RzW2ldLmNhdGVnb3JpZXMoKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRcdGZpbHRlci5wdXNoKGNvbnRhY3RzW2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKGNvbnRhY3RzW2ldLmNhdGVnb3JpZXMoKS5pbmRleE9mKGdyb3VwKSA+PSAwKSB7XG5cdFx0XHRcdFx0XHRmaWx0ZXIucHVzaChjb250YWN0c1tpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXI7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdmaWVsZEZpbHRlcicsIGZ1bmN0aW9uKCkge1xuXHQndXNlIHN0cmljdCc7XG5cdHJldHVybiBmdW5jdGlvbiAoZmllbGRzLCBjb250YWN0KSB7XG5cdFx0aWYgKHR5cGVvZiBmaWVsZHMgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gZmllbGRzO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGNvbnRhY3QgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gZmllbGRzO1xuXHRcdH1cblx0XHR2YXIgZmlsdGVyID0gW107XG5cdFx0aWYgKGZpZWxkcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAoZmllbGRzW2ldLm11bHRpcGxlICkge1xuXHRcdFx0XHRcdGZpbHRlci5wdXNoKGZpZWxkc1tpXSk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKF8uaXNVbmRlZmluZWQoY29udGFjdC5nZXRQcm9wZXJ0eShmaWVsZHNbaV0uaWQpKSkge1xuXHRcdFx0XHRcdGZpbHRlci5wdXNoKGZpZWxkc1tpXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZpbHRlcjtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2ZpcnN0Q2hhcmFjdGVyJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiBpbnB1dC5jaGFyQXQoMCk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdsb2NhbGVPcmRlckJ5JywgW2Z1bmN0aW9uICgpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIChhcnJheSwgc29ydFByZWRpY2F0ZSwgcmV2ZXJzZU9yZGVyKSB7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSkgcmV0dXJuIGFycmF5O1xuXHRcdGlmICghc29ydFByZWRpY2F0ZSkgcmV0dXJuIGFycmF5O1xuXG5cdFx0dmFyIGFycmF5Q29weSA9IFtdO1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChhcnJheSwgZnVuY3Rpb24gKGl0ZW0pIHtcblx0XHRcdGFycmF5Q29weS5wdXNoKGl0ZW0pO1xuXHRcdH0pO1xuXG5cdFx0YXJyYXlDb3B5LnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdHZhciB2YWx1ZUEgPSBhW3NvcnRQcmVkaWNhdGVdO1xuXHRcdFx0aWYgKGFuZ3VsYXIuaXNGdW5jdGlvbih2YWx1ZUEpKSB7XG5cdFx0XHRcdHZhbHVlQSA9IGFbc29ydFByZWRpY2F0ZV0oKTtcblx0XHRcdH1cblx0XHRcdHZhciB2YWx1ZUIgPSBiW3NvcnRQcmVkaWNhdGVdO1xuXHRcdFx0aWYgKGFuZ3VsYXIuaXNGdW5jdGlvbih2YWx1ZUIpKSB7XG5cdFx0XHRcdHZhbHVlQiA9IGJbc29ydFByZWRpY2F0ZV0oKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFuZ3VsYXIuaXNTdHJpbmcodmFsdWVBKSkge1xuXHRcdFx0XHRyZXR1cm4gIXJldmVyc2VPcmRlciA/IHZhbHVlQS5sb2NhbGVDb21wYXJlKHZhbHVlQikgOiB2YWx1ZUIubG9jYWxlQ29tcGFyZSh2YWx1ZUEpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYW5ndWxhci5pc051bWJlcih2YWx1ZUEpIHx8IGFuZ3VsYXIuaXNCb29sZWFuKHZhbHVlQSkpIHtcblx0XHRcdFx0cmV0dXJuICFyZXZlcnNlT3JkZXIgPyB2YWx1ZUEgLSB2YWx1ZUIgOiB2YWx1ZUIgLSB2YWx1ZUE7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGFycmF5Q29weTtcblx0fTtcbn1dKTtcblxuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ25ld0NvbnRhY3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIGlucHV0ICE9PSAnJyA/IGlucHV0IDogdCgnY29udGFjdHMnLCAnTmV3IGNvbnRhY3QnKTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ29yZGVyRGV0YWlsSXRlbXMnLCBmdW5jdGlvbih2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0cmV0dXJuIGZ1bmN0aW9uKGl0ZW1zLCBmaWVsZCwgcmV2ZXJzZSkge1xuXG5cdFx0dmFyIGZpbHRlcmVkID0gW107XG5cdFx0YW5ndWxhci5mb3JFYWNoKGl0ZW1zLCBmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRmaWx0ZXJlZC5wdXNoKGl0ZW0pO1xuXHRcdH0pO1xuXG5cdFx0dmFyIGZpZWxkT3JkZXIgPSBhbmd1bGFyLmNvcHkodkNhcmRQcm9wZXJ0aWVzU2VydmljZS5maWVsZE9yZGVyKTtcblx0XHQvLyByZXZlcnNlIHRvIG1vdmUgY3VzdG9tIGl0ZW1zIHRvIHRoZSBlbmQgKGluZGV4T2YgPT0gLTEpXG5cdFx0ZmllbGRPcmRlci5yZXZlcnNlKCk7XG5cblx0XHRmaWx0ZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHRpZihmaWVsZE9yZGVyLmluZGV4T2YoYVtmaWVsZF0pIDwgZmllbGRPcmRlci5pbmRleE9mKGJbZmllbGRdKSkge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHRcdGlmKGZpZWxkT3JkZXIuaW5kZXhPZihhW2ZpZWxkXSkgPiBmaWVsZE9yZGVyLmluZGV4T2YoYltmaWVsZF0pKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXG5cdFx0aWYocmV2ZXJzZSkgZmlsdGVyZWQucmV2ZXJzZSgpO1xuXHRcdHJldHVybiBmaWx0ZXJlZDtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ3RvQXJyYXknLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuXHRcdGlmICghKG9iaiBpbnN0YW5jZW9mIE9iamVjdCkpIHJldHVybiBvYmo7XG5cdFx0cmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsLCBrZXkpIHtcblx0XHRcdHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkodmFsLCAnJGtleScsIHt2YWx1ZToga2V5fSk7XG5cdFx0fSk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCd2Q2FyZDJKU09OJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiB2Q2FyZC5wYXJzZShpbnB1dCk7XG5cdH07XG59KTtcbiJdLCJzb3VyY2VSb290IjoiL3NvdXJjZS8ifQ==
