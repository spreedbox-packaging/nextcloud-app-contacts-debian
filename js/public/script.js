/**
 * Nextcloud - contacts
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
		addContact : t('contacts', 'New contact')
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

			dateProperties: ['bday', 'anniversary', 'deathdate'],

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
						return property.value.filter(function(elem) {
							return elem;
						}).join(' ');
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

			formatDateAsRFC6350: function(name, data) {
				if (_.isUndefined(data) || _.isUndefined(data.value)) {
					return data;
				}
				if (this.dateProperties.indexOf(name) !== -1) {
					var match = data.value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
					if (match) {
						data.value = match[1] + match[2] + match[3];
					}
				}

				return data;
			},

			formatDateForDisplay: function(name, data) {
				if (_.isUndefined(data) || _.isUndefined(data.value)) {
					return data;
				}
				if (this.dateProperties.indexOf(name) !== -1) {
					var match = data.value.match(/^(\d{4})(\d{2})(\d{2})$/);
					if (match) {
						data.value = match[1] + '-' + match[2] + '-' + match[3];
					}
				}

				return data;
			},

			getProperty: function(name) {
				if (this.props[name]) {
					return this.formatDateForDisplay(name, this.props[name][0]);
				} else {
					return undefined;
				}
			},
			addProperty: function(name, data) {
				data = angular.copy(data);
				data = this.formatDateAsRFC6350(name, data);
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
				data = this.formatDateAsRFC6350(name, data);
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
				var self = this;

				_.each(this.dateProperties, function(name) {
					if (!_.isUndefined(self.props[name]) && !_.isUndefined(self.props[name][0])) {
						// Set dates again to make sure they are in RFC-6350 format
						self.setProperty(name, self.props[name][0]);
					}
				});
				// force fn to be set
				this.fullName(this.fullName());

				// keep vCard in sync
				self.data.addressData = $filter('JSON2vCard')(self.props);
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
		if (_.isUndefined(newContact.fullName()) || newContact.fullName() === '') {
			newContact.fullName(t('contacts', 'New contact'));
		}

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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJkYXRlcGlja2VyX2RpcmVjdGl2ZS5qcyIsImZvY3VzX2RpcmVjdGl2ZS5qcyIsImlucHV0cmVzaXplX2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rL2FkZHJlc3NCb29rX2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9vay9hZGRyZXNzQm9va19kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2RpcmVjdGl2ZS5qcyIsImF2YXRhci9hdmF0YXJfY29udHJvbGxlci5qcyIsImF2YXRhci9hdmF0YXJfZGlyZWN0aXZlLmpzIiwiY29udGFjdC9jb250YWN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0L2NvbnRhY3RfZGlyZWN0aXZlLmpzIiwiY29udGFjdERldGFpbHMvY29udGFjdERldGFpbHNfY29udHJvbGxlci5qcyIsImNvbnRhY3REZXRhaWxzL2NvbnRhY3REZXRhaWxzX2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RJbXBvcnQvY29udGFjdEltcG9ydF9jb250cm9sbGVyLmpzIiwiY29udGFjdEltcG9ydC9jb250YWN0SW1wb3J0X2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RMaXN0L2NvbnRhY3RMaXN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0TGlzdC9jb250YWN0TGlzdF9kaXJlY3RpdmUuanMiLCJkZXRhaWxzSXRlbS9kZXRhaWxzSXRlbV9jb250cm9sbGVyLmpzIiwiZGV0YWlsc0l0ZW0vZGV0YWlsc0l0ZW1fZGlyZWN0aXZlLmpzIiwiZ3JvdXAvZ3JvdXBfY29udHJvbGxlci5qcyIsImdyb3VwL2dyb3VwX2RpcmVjdGl2ZS5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfY29udHJvbGxlci5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfZGlyZWN0aXZlLmpzIiwibmV3Q29udGFjdEJ1dHRvbi9uZXdDb250YWN0QnV0dG9uX2NvbnRyb2xsZXIuanMiLCJuZXdDb250YWN0QnV0dG9uL25ld0NvbnRhY3RCdXR0b25fZGlyZWN0aXZlLmpzIiwicGFyc2Vycy9ncm91cE1vZGVsX2RpcmVjdGl2ZS5qcyIsInBhcnNlcnMvdGVsTW9kZWxfZGlyZWN0aXZlLmpzIiwiYWRkcmVzc0Jvb2tfbW9kZWwuanMiLCJjb250YWN0X21vZGVsLmpzIiwiYWRkcmVzc0Jvb2tfc2VydmljZS5qcyIsImNvbnRhY3Rfc2VydmljZS5qcyIsImRhdkNsaWVudF9zZXJ2aWNlLmpzIiwiZGF2X3NlcnZpY2UuanMiLCJzZWFyY2hfc2VydmljZS5qcyIsInNldHRpbmdzX3NlcnZpY2UuanMiLCJ2Q2FyZFByb3BlcnRpZXMuanMiLCJKU09OMnZDYXJkX2ZpbHRlci5qcyIsImNvbnRhY3RDb2xvcl9maWx0ZXIuanMiLCJjb250YWN0R3JvdXBfZmlsdGVyLmpzIiwiZmllbGRfZmlsdGVyLmpzIiwiZmlyc3RDaGFyYWN0ZXJfZmlsdGVyLmpzIiwibG9jYWxlT3JkZXJCeV9maWx0ZXIuanMiLCJuZXdDb250YWN0X2ZpbHRlci5qcyIsIm9yZGVyRGV0YWlsSXRlbXNfZmlsdGVyLmpzIiwidG9BcnJheV9maWx0ZXIuanMiLCJ2Q2FyZDJKU09OX2ZpbHRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7Ozs7OztBQVVBLFFBQVEsT0FBTyxlQUFlLENBQUMsU0FBUyxpQkFBaUIsV0FBVyxnQkFBZ0IsYUFBYTtDQUNoRywwQkFBTyxTQUFTLGdCQUFnQjs7Q0FFaEMsZUFBZSxLQUFLLFNBQVM7RUFDNUIsVUFBVTs7O0NBR1gsZUFBZSxLQUFLLGNBQWM7RUFDakMsVUFBVTs7O0NBR1gsZUFBZSxVQUFVLE1BQU0sRUFBRSxZQUFZOzs7QUFHOUM7QUN4QkEsUUFBUSxPQUFPO0NBQ2QsVUFBVSxjQUFjLFdBQVc7Q0FDbkMsT0FBTztFQUNOLFVBQVU7RUFDVixVQUFVO0VBQ1YsT0FBTyxVQUFVLE9BQU8sU0FBUyxPQUFPLGFBQWE7R0FDcEQsRUFBRSxXQUFX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TztFQUN0QixPQUFPLE1BQU0sTUFBTTs7O0FBR3JCIiwiZmlsZSI6InNjcmlwdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTmV4dGNsb3VkIC0gY29udGFjdHNcbiAqXG4gKiBUaGlzIGZpbGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEFmZmVybyBHZW5lcmFsIFB1YmxpYyBMaWNlbnNlIHZlcnNpb24gMyBvclxuICogbGF0ZXIuIFNlZSB0aGUgQ09QWUlORyBmaWxlLlxuICpcbiAqIEBhdXRob3IgSGVuZHJpayBMZXBwZWxzYWNrIDxoZW5kcmlrQGxlcHBlbHNhY2suZGU+XG4gKiBAY29weXJpZ2h0IEhlbmRyaWsgTGVwcGVsc2FjayAyMDE1XG4gKi9cblxuYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJywgWyd1dWlkNCcsICdhbmd1bGFyLWNhY2hlJywgJ25nUm91dGUnLCAndWkuYm9vdHN0cmFwJywgJ3VpLnNlbGVjdCcsICduZ1Nhbml0aXplJ10pXG4uY29uZmlnKGZ1bmN0aW9uKCRyb3V0ZVByb3ZpZGVyKSB7XG5cblx0JHJvdXRlUHJvdmlkZXIud2hlbignLzpnaWQnLCB7XG5cdFx0dGVtcGxhdGU6ICc8Y29udGFjdGRldGFpbHM+PC9jb250YWN0ZGV0YWlscz4nXG5cdH0pO1xuXG5cdCRyb3V0ZVByb3ZpZGVyLndoZW4oJy86Z2lkLzp1aWQnLCB7XG5cdFx0dGVtcGxhdGU6ICc8Y29udGFjdGRldGFpbHM+PC9jb250YWN0ZGV0YWlscz4nXG5cdH0pO1xuXG5cdCRyb3V0ZVByb3ZpZGVyLm90aGVyd2lzZSgnLycgKyB0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2RhdGVwaWNrZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdHJlcXVpcmUgOiAnbmdNb2RlbCcsXG5cdFx0bGluayA6IGZ1bmN0aW9uIChzY29wZSwgZWxlbWVudCwgYXR0cnMsIG5nTW9kZWxDdHJsKSB7XG5cdFx0XHQkKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRlbGVtZW50LmRhdGVwaWNrZXIoe1xuXHRcdFx0XHRcdGRhdGVGb3JtYXQ6J3l5LW1tLWRkJyxcblx0XHRcdFx0XHRtaW5EYXRlOiBudWxsLFxuXHRcdFx0XHRcdG1heERhdGU6IG51bGwsXG5cdFx0XHRcdFx0b25TZWxlY3Q6ZnVuY3Rpb24gKGRhdGUpIHtcblx0XHRcdFx0XHRcdG5nTW9kZWxDdHJsLiRzZXRWaWV3VmFsdWUoZGF0ZSk7XG5cdFx0XHRcdFx0XHRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZm9jdXNFeHByZXNzaW9uJywgZnVuY3Rpb24gKCR0aW1lb3V0KSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRsaW5rOiB7XG5cdFx0XHRwb3N0OiBmdW5jdGlvbiBwb3N0TGluayhzY29wZSwgZWxlbWVudCwgYXR0cnMpIHtcblx0XHRcdFx0c2NvcGUuJHdhdGNoKGF0dHJzLmZvY3VzRXhwcmVzc2lvbiwgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmIChhdHRycy5mb2N1c0V4cHJlc3Npb24pIHtcblx0XHRcdFx0XHRcdGlmIChzY29wZS4kZXZhbChhdHRycy5mb2N1c0V4cHJlc3Npb24pKSB7XG5cdFx0XHRcdFx0XHRcdCR0aW1lb3V0KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoZWxlbWVudC5pcygnaW5wdXQnKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZWxlbWVudC5mb2N1cygpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRlbGVtZW50LmZpbmQoJ2lucHV0JykuZm9jdXMoKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sIDEwMCk7IC8vbmVlZCBzb21lIGRlbGF5IHRvIHdvcmsgd2l0aCBuZy1kaXNhYmxlZFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnaW5wdXRyZXNpemUnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLFxuXHRcdGxpbmsgOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBlbElucHV0ID0gZWxlbWVudC52YWwoKTtcblx0XHRcdGVsZW1lbnQuYmluZCgna2V5ZG93biBrZXl1cCBsb2FkIGZvY3VzJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGVsSW5wdXQgPSBlbGVtZW50LnZhbCgpO1xuXHRcdFx0XHQvLyBJZiBzZXQgdG8gMCwgdGhlIG1pbi13aWR0aCBjc3MgZGF0YSBpcyBpZ25vcmVkXG5cdFx0XHRcdHZhciBsZW5ndGggPSBlbElucHV0Lmxlbmd0aCA+IDEgPyBlbElucHV0Lmxlbmd0aCA6IDE7XG5cdFx0XHRcdGVsZW1lbnQuYXR0cignc2l6ZScsIGxlbmd0aCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYWRkcmVzc2Jvb2tDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBBZGRyZXNzQm9va1NlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwuc2hvd1VybCA9IGZhbHNlO1xuXHQvKiBnbG9iYWxzIG9jX2NvbmZpZyAqL1xuXHQvKiBlc2xpbnQtZGlzYWJsZSBjYW1lbGNhc2UgKi9cblx0Y3RybC5jYW5FeHBvcnQgPSBvY19jb25maWcudmVyc2lvbi5zcGxpdCgnLicpID49IFs5LCAwLCAyLCAwXTtcblx0LyogZXNsaW50LWVuYWJsZSBjYW1lbGNhc2UgKi9cblxuXHRjdHJsLnRvZ2dsZVNob3dVcmwgPSBmdW5jdGlvbigpIHtcblx0XHRjdHJsLnNob3dVcmwgPSAhY3RybC5zaG93VXJsO1xuXHR9O1xuXG5cdGN0cmwudG9nZ2xlU2hhcmVzRWRpdG9yID0gZnVuY3Rpb24oKSB7XG5cdFx0Y3RybC5lZGl0aW5nU2hhcmVzID0gIWN0cmwuZWRpdGluZ1NoYXJlcztcblx0XHRjdHJsLnNlbGVjdGVkU2hhcmVlID0gbnVsbDtcblx0fTtcblxuXHQvKiBGcm9tIENhbGVuZGFyLVJld29yayAtIGpzL2FwcC9jb250cm9sbGVycy9jYWxlbmRhcmxpc3Rjb250cm9sbGVyLmpzICovXG5cdGN0cmwuZmluZFNoYXJlZSA9IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gJC5nZXQoXG5cdFx0XHRPQy5saW5rVG9PQ1MoJ2FwcHMvZmlsZXNfc2hhcmluZy9hcGkvdjEnKSArICdzaGFyZWVzJyxcblx0XHRcdHtcblx0XHRcdFx0Zm9ybWF0OiAnanNvbicsXG5cdFx0XHRcdHNlYXJjaDogdmFsLnRyaW0oKSxcblx0XHRcdFx0cGVyUGFnZTogMjAwLFxuXHRcdFx0XHRpdGVtVHlwZTogJ3ByaW5jaXBhbHMnXG5cdFx0XHR9XG5cdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3VsdCkge1xuXHRcdFx0Ly8gVG9kbyAtIGZpbHRlciBvdXQgY3VycmVudCB1c2VyLCBleGlzdGluZyBzaGFyZWVzXG5cdFx0XHR2YXIgdXNlcnMgICA9IHJlc3VsdC5vY3MuZGF0YS5leGFjdC51c2Vycy5jb25jYXQocmVzdWx0Lm9jcy5kYXRhLnVzZXJzKTtcblx0XHRcdHZhciBncm91cHMgID0gcmVzdWx0Lm9jcy5kYXRhLmV4YWN0Lmdyb3Vwcy5jb25jYXQocmVzdWx0Lm9jcy5kYXRhLmdyb3Vwcyk7XG5cblx0XHRcdHZhciB1c2VyU2hhcmVzID0gY3RybC5hZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzO1xuXHRcdFx0dmFyIHVzZXJTaGFyZXNMZW5ndGggPSB1c2VyU2hhcmVzLmxlbmd0aDtcblx0XHRcdHZhciBpLCBqO1xuXG5cdFx0XHQvLyBGaWx0ZXIgb3V0IGN1cnJlbnQgdXNlclxuXHRcdFx0dmFyIHVzZXJzTGVuZ3RoID0gdXNlcnMubGVuZ3RoO1xuXHRcdFx0Zm9yIChpID0gMCA7IGkgPCB1c2Vyc0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmICh1c2Vyc1tpXS52YWx1ZS5zaGFyZVdpdGggPT09IE9DLmN1cnJlbnRVc2VyKSB7XG5cdFx0XHRcdFx0dXNlcnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIE5vdyBmaWx0ZXIgb3V0IGFsbCBzaGFyZWVzIHRoYXQgYXJlIGFscmVhZHkgc2hhcmVkIHdpdGhcblx0XHRcdGZvciAoaSA9IDA7IGkgPCB1c2VyU2hhcmVzTGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0dmFyIHNoYXJlID0gdXNlclNoYXJlc1tpXTtcblx0XHRcdFx0dXNlcnNMZW5ndGggPSB1c2Vycy5sZW5ndGg7XG5cdFx0XHRcdGZvciAoaiA9IDA7IGogPCB1c2Vyc0xlbmd0aDsgaisrKSB7XG5cdFx0XHRcdFx0aWYgKHVzZXJzW2pdLnZhbHVlLnNoYXJlV2l0aCA9PT0gc2hhcmUuaWQpIHtcblx0XHRcdFx0XHRcdHVzZXJzLnNwbGljZShqLCAxKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBDb21iaW5lIHVzZXJzIGFuZCBncm91cHNcblx0XHRcdHVzZXJzID0gdXNlcnMubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkaXNwbGF5OiBpdGVtLnZhbHVlLnNoYXJlV2l0aCxcblx0XHRcdFx0XHR0eXBlOiBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIsXG5cdFx0XHRcdFx0aWRlbnRpZmllcjogaXRlbS52YWx1ZS5zaGFyZVdpdGhcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0XHRncm91cHMgPSBncm91cHMubWFwKGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkaXNwbGF5OiBpdGVtLnZhbHVlLnNoYXJlV2l0aCArICcgKGdyb3VwKScsXG5cdFx0XHRcdFx0dHlwZTogT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCxcblx0XHRcdFx0XHRpZGVudGlmaWVyOiBpdGVtLnZhbHVlLnNoYXJlV2l0aFxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cblx0XHRcdHJldHVybiBncm91cHMuY29uY2F0KHVzZXJzKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLm9uU2VsZWN0U2hhcmVlID0gZnVuY3Rpb24gKGl0ZW0pIHtcblx0XHRjdHJsLnNlbGVjdGVkU2hhcmVlID0gbnVsbDtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2Uuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgaXRlbS50eXBlLCBpdGVtLmlkZW50aWZpZXIsIGZhbHNlLCBmYWxzZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblxuXHR9O1xuXG5cdGN0cmwudXBkYXRlRXhpc3RpbmdVc2VyU2hhcmUgPSBmdW5jdGlvbih1c2VySWQsIHdyaXRhYmxlKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUiwgdXNlcklkLCB3cml0YWJsZSwgdHJ1ZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVwZGF0ZUV4aXN0aW5nR3JvdXBTaGFyZSA9IGZ1bmN0aW9uKGdyb3VwSWQsIHdyaXRhYmxlKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsIGdyb3VwSWQsIHdyaXRhYmxlLCB0cnVlKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudW5zaGFyZUZyb21Vc2VyID0gZnVuY3Rpb24odXNlcklkKSB7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnVuc2hhcmUoY3RybC5hZGRyZXNzQm9vaywgT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSLCB1c2VySWQpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51bnNoYXJlRnJvbUdyb3VwID0gZnVuY3Rpb24oZ3JvdXBJZCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS51bnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsIGdyb3VwSWQpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5kZWxldGVBZGRyZXNzQm9vayA9IGZ1bmN0aW9uKCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5kZWxldGUoY3RybC5hZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYWRkcmVzc2Jvb2snLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLCAvLyBoYXMgdG8gYmUgYW4gYXR0cmlidXRlIHRvIHdvcmsgd2l0aCBjb3JlIGNzc1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnYWRkcmVzc2Jvb2tDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7XG5cdFx0XHRhZGRyZXNzQm9vazogJz1kYXRhJyxcblx0XHRcdGxpc3Q6ICc9J1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2FkZHJlc3NCb29rLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2FkZHJlc3Nib29rbGlzdEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIEFkZHJlc3NCb29rU2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblxuXHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRjdHJsLmFkZHJlc3NCb29rcyA9IGFkZHJlc3NCb29rcztcblx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0fSk7XG5cblx0Y3RybC50ID0ge1xuXHRcdGFkZHJlc3NCb29rTmFtZSA6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MgYm9vayBuYW1lJylcblx0fTtcblxuXHRjdHJsLmNyZWF0ZUFkZHJlc3NCb29rID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYoY3RybC5uZXdBZGRyZXNzQm9va05hbWUpIHtcblx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5jcmVhdGUoY3RybC5uZXdBZGRyZXNzQm9va05hbWUpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5nZXRBZGRyZXNzQm9vayhjdHJsLm5ld0FkZHJlc3NCb29rTmFtZSkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdGN0cmwuYWRkcmVzc0Jvb2tzLnB1c2goYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdhZGRyZXNzYm9va2xpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rbGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9va0xpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignYXZhdGFyQ3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmltcG9ydCA9IENvbnRhY3RTZXJ2aWNlLmltcG9ydC5iaW5kKENvbnRhY3RTZXJ2aWNlKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYXZhdGFyJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBpbXBvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnSW1wb3J0Jyk7XG5cdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblxuXHRcdFx0dmFyIGlucHV0ID0gZWxlbWVudC5maW5kKCdpbnB1dCcpO1xuXHRcdFx0aW5wdXQuYmluZCgnY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlID0gaW5wdXQuZ2V0KDApLmZpbGVzWzBdO1xuXHRcdFx0XHRpZiAoZmlsZS5zaXplID4gMTAyNCoxMDI0KSB7IC8vIDEgTUJcblx0XHRcdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdUaGUgc2VsZWN0ZWQgaW1hZ2UgaXMgdG9vIGJpZyAobWF4IDFNQiknKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0XHRcdFx0c2NvcGUuY29udGFjdC5waG90byhyZWFkZXIucmVzdWx0KTtcblx0XHRcdFx0XHRcdFx0Q29udGFjdFNlcnZpY2UudXBkYXRlKHNjb3BlLmNvbnRhY3QpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSwgZmFsc2UpO1xuXG5cdFx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRcdHJlYWRlci5yZWFkQXNEYXRhVVJMKGZpbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYXZhdGFyLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2NvbnRhY3RDdHJsJywgZnVuY3Rpb24oJHJvdXRlLCAkcm91dGVQYXJhbXMpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwub3BlbkNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdHVpZDogY3RybC5jb250YWN0LnVpZCgpfSk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0Q3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2NvbnRhY3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGRldGFpbHNDdHJsJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UsIEFkZHJlc3NCb29rU2VydmljZSwgdkNhcmRQcm9wZXJ0aWVzU2VydmljZSwgJHJvdXRlLCAkcm91dGVQYXJhbXMsICRzY29wZSkge1xuXG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmxvYWRpbmcgPSB0cnVlO1xuXHRjdHJsLnNob3cgPSBmYWxzZTtcblxuXHRjdHJsLmNsZWFyQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0dWlkOiB1bmRlZmluZWRcblx0XHR9KTtcblx0XHRjdHJsLnNob3cgPSBmYWxzZTtcblx0XHRjdHJsLmNvbnRhY3QgPSB1bmRlZmluZWQ7XG5cdH07XG5cblx0Y3RybC51aWQgPSAkcm91dGVQYXJhbXMudWlkO1xuXHRjdHJsLnQgPSB7XG5cdFx0bm9Db250YWN0cyA6IHQoJ2NvbnRhY3RzJywgJ05vIGNvbnRhY3RzIGluIGhlcmUnKSxcblx0XHRwbGFjZWhvbGRlck5hbWUgOiB0KCdjb250YWN0cycsICdOYW1lJyksXG5cdFx0cGxhY2Vob2xkZXJPcmcgOiB0KCdjb250YWN0cycsICdPcmdhbml6YXRpb24nKSxcblx0XHRwbGFjZWhvbGRlclRpdGxlIDogdCgnY29udGFjdHMnLCAnVGl0bGUnKSxcblx0XHRzZWxlY3RGaWVsZCA6IHQoJ2NvbnRhY3RzJywgJ0FkZCBmaWVsZCAuLi4nKVxuXHR9O1xuXG5cdGN0cmwuZmllbGREZWZpbml0aW9ucyA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZmllbGREZWZpbml0aW9ucztcblx0Y3RybC5mb2N1cyA9IHVuZGVmaW5lZDtcblx0Y3RybC5maWVsZCA9IHVuZGVmaW5lZDtcblx0Y3RybC5hZGRyZXNzQm9va3MgPSBbXTtcblxuXHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRjdHJsLmFkZHJlc3NCb29rcyA9IGFkZHJlc3NCb29rcztcblxuXHRcdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmNvbnRhY3QpKSB7XG5cdFx0XHRjdHJsLmFkZHJlc3NCb29rID0gXy5maW5kKGN0cmwuYWRkcmVzc0Jvb2tzLCBmdW5jdGlvbihib29rKSB7XG5cdFx0XHRcdHJldHVybiBib29rLmRpc3BsYXlOYW1lID09PSBjdHJsLmNvbnRhY3QuYWRkcmVzc0Jvb2tJZDtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC51aWQnLCBmdW5jdGlvbihuZXdWYWx1ZSkge1xuXHRcdGN0cmwuY2hhbmdlQ29udGFjdChuZXdWYWx1ZSk7XG5cdH0pO1xuXG5cdGN0cmwuY2hhbmdlQ29udGFjdCA9IGZ1bmN0aW9uKHVpZCkge1xuXHRcdGlmICh0eXBlb2YgdWlkID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y3RybC5zaG93ID0gZmFsc2U7XG5cdFx0XHQkKCcjYXBwLW5hdmlnYXRpb24tdG9nZ2xlJykucmVtb3ZlQ2xhc3MoJ3Nob3dkZXRhaWxzJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdENvbnRhY3RTZXJ2aWNlLmdldEJ5SWQodWlkKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdGlmIChhbmd1bGFyLmlzVW5kZWZpbmVkKGNvbnRhY3QpKSB7XG5cdFx0XHRcdGN0cmwuY2xlYXJDb250YWN0KCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGN0cmwuY29udGFjdCA9IGNvbnRhY3Q7XG5cdFx0XHRjdHJsLnNob3cgPSB0cnVlO1xuXHRcdFx0JCgnI2FwcC1uYXZpZ2F0aW9uLXRvZ2dsZScpLmFkZENsYXNzKCdzaG93ZGV0YWlscycpO1xuXG5cdFx0XHRjdHJsLmFkZHJlc3NCb29rID0gXy5maW5kKGN0cmwuYWRkcmVzc0Jvb2tzLCBmdW5jdGlvbihib29rKSB7XG5cdFx0XHRcdHJldHVybiBib29rLmRpc3BsYXlOYW1lID09PSBjdHJsLmNvbnRhY3QuYWRkcmVzc0Jvb2tJZDtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudXBkYXRlQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdENvbnRhY3RTZXJ2aWNlLnVwZGF0ZShjdHJsLmNvbnRhY3QpO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdENvbnRhY3RTZXJ2aWNlLmRlbGV0ZShjdHJsLmNvbnRhY3QpO1xuXHR9O1xuXG5cdGN0cmwuYWRkRmllbGQgPSBmdW5jdGlvbihmaWVsZCkge1xuXHRcdHZhciBkZWZhdWx0VmFsdWUgPSB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmdldE1ldGEoZmllbGQpLmRlZmF1bHRWYWx1ZSB8fCB7dmFsdWU6ICcnfTtcblx0XHRjdHJsLmNvbnRhY3QuYWRkUHJvcGVydHkoZmllbGQsIGRlZmF1bHRWYWx1ZSk7XG5cdFx0Y3RybC5mb2N1cyA9IGZpZWxkO1xuXHRcdGN0cmwuZmllbGQgPSAnJztcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKGZpZWxkLCBwcm9wKSB7XG5cdFx0Y3RybC5jb250YWN0LnJlbW92ZVByb3BlcnR5KGZpZWxkLCBwcm9wKTtcblx0XHRjdHJsLmZvY3VzID0gdW5kZWZpbmVkO1xuXHR9O1xuXG5cdGN0cmwuY2hhbmdlQWRkcmVzc0Jvb2sgPSBmdW5jdGlvbiAoYWRkcmVzc0Jvb2spIHtcblx0XHRDb250YWN0U2VydmljZS5tb3ZlQ29udGFjdChjdHJsLmNvbnRhY3QsIGFkZHJlc3NCb29rKTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RkZXRhaWxzJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cHJpb3JpdHk6IDEsXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdjb250YWN0ZGV0YWlsc0N0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0RGV0YWlscy5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdjb250YWN0aW1wb3J0Q3RybCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLmltcG9ydCA9IENvbnRhY3RTZXJ2aWNlLmltcG9ydC5iaW5kKENvbnRhY3RTZXJ2aWNlKTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdGltcG9ydCcsIGZ1bmN0aW9uKENvbnRhY3RTZXJ2aWNlKSB7XG5cdHJldHVybiB7XG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQpIHtcblx0XHRcdHZhciBpbXBvcnRUZXh0ID0gdCgnY29udGFjdHMnLCAnSW1wb3J0Jyk7XG5cdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblxuXHRcdFx0dmFyIGlucHV0ID0gZWxlbWVudC5maW5kKCdpbnB1dCcpO1xuXHRcdFx0aW5wdXQuYmluZCgnY2hhbmdlJywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHZhciBmaWxlID0gaW5wdXQuZ2V0KDApLmZpbGVzWzBdO1xuXHRcdFx0XHR2YXIgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcblxuXHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRDb250YWN0U2VydmljZS5pbXBvcnQuY2FsbChDb250YWN0U2VydmljZSwgcmVhZGVyLnJlc3VsdCwgZmlsZS50eXBlLCBudWxsLCBmdW5jdGlvbihwcm9ncmVzcykge1xuXHRcdFx0XHRcdFx0XHRpZihwcm9ncmVzcz09PTEpIHtcblx0XHRcdFx0XHRcdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gaW1wb3J0VGV4dDtcblx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRzY29wZS5pbXBvcnRUZXh0ID0gcGFyc2VJbnQoTWF0aC5mbG9vcihwcm9ncmVzcyoxMDApKSsnJSc7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9LCBmYWxzZSk7XG5cblx0XHRcdFx0aWYgKGZpbGUpIHtcblx0XHRcdFx0XHRyZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnB1dC5nZXQoMCkudmFsdWUgPSAnJztcblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2NvbnRhY3RJbXBvcnQuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkZmlsdGVyLCAkcm91dGUsICRyb3V0ZVBhcmFtcywgQ29udGFjdFNlcnZpY2UsIHZDYXJkUHJvcGVydGllc1NlcnZpY2UsIFNlYXJjaFNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwucm91dGVQYXJhbXMgPSAkcm91dGVQYXJhbXM7XG5cblx0Y3RybC5jb250YWN0TGlzdCA9IFtdO1xuXHRjdHJsLnNlYXJjaFRlcm0gPSAnJztcblx0Y3RybC5zaG93ID0gdHJ1ZTtcblx0Y3RybC5pbnZhbGlkID0gZmFsc2U7XG5cblx0Y3RybC50ID0ge1xuXHRcdGVtcHR5U2VhcmNoIDogdCgnY29udGFjdHMnLCAnTm8gc2VhcmNoIHJlc3VsdCBmb3Ige3F1ZXJ5fScsIHtxdWVyeTogY3RybC5zZWFyY2hUZXJtfSlcblx0fTtcblxuXHQkc2NvcGUuZ2V0Q291bnRTdHJpbmcgPSBmdW5jdGlvbihjb250YWN0cykge1xuXHRcdHJldHVybiBuKCdjb250YWN0cycsICclbiBjb250YWN0JywgJyVuIGNvbnRhY3RzJywgY29udGFjdHMubGVuZ3RoKTtcblx0fTtcblxuXHQkc2NvcGUucXVlcnkgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0cmV0dXJuIGNvbnRhY3QubWF0Y2hlcyhTZWFyY2hTZXJ2aWNlLmdldFNlYXJjaFRlcm0oKSk7XG5cdH07XG5cblx0U2VhcmNoU2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oZXYpIHtcblx0XHRpZiAoZXYuZXZlbnQgPT09ICdzdWJtaXRTZWFyY2gnKSB7XG5cdFx0XHR2YXIgdWlkID0gIV8uaXNFbXB0eShjdHJsLmNvbnRhY3RMaXN0KSA/IGN0cmwuY29udGFjdExpc3RbMF0udWlkKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQodWlkKTtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9XG5cdFx0aWYgKGV2LmV2ZW50ID09PSAnY2hhbmdlU2VhcmNoJykge1xuXHRcdFx0Y3RybC5zZWFyY2hUZXJtID0gZXYuc2VhcmNoVGVybTtcblx0XHRcdGN0cmwudC5lbXB0eVNlYXJjaCA9IHQoJ2NvbnRhY3RzJyxcblx0XHRcdFx0XHRcdFx0XHQgICAnTm8gc2VhcmNoIHJlc3VsdCBmb3Ige3F1ZXJ5fScsXG5cdFx0XHRcdFx0XHRcdFx0ICAge3F1ZXJ5OiBjdHJsLnNlYXJjaFRlcm19XG5cdFx0XHRcdFx0XHRcdFx0ICApO1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH1cblx0fSk7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oZXYpIHtcblx0XHQkc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGV2LmV2ZW50ID09PSAnZGVsZXRlJykge1xuXHRcdFx0XHRpZiAoY3RybC5jb250YWN0TGlzdC5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdHVpZDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGN0cmwuY29udGFjdExpc3QubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGlmIChjdHJsLmNvbnRhY3RMaXN0W2ldLnVpZCgpID09PSBldi51aWQpIHtcblx0XHRcdFx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0XHRcdHVpZDogKGN0cmwuY29udGFjdExpc3RbaSsxXSkgPyBjdHJsLmNvbnRhY3RMaXN0W2krMV0udWlkKCkgOiBjdHJsLmNvbnRhY3RMaXN0W2ktMV0udWlkKClcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoZXYuZXZlbnQgPT09ICdjcmVhdGUnKSB7XG5cdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHR1aWQ6IGV2LnVpZFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGN0cmwuY29udGFjdHMgPSBldi5jb250YWN0cztcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gR2V0IGNvbnRhY3RzXG5cdENvbnRhY3RTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRpZihjb250YWN0cy5sZW5ndGg+MCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0Y3RybC5jb250YWN0cyA9IGNvbnRhY3RzO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdH1cblx0fSk7XG5cblx0Ly8gV2FpdCBmb3IgY3RybC5jb250YWN0TGlzdCB0byBiZSB1cGRhdGVkLCBsb2FkIHRoZSBmaXJzdCBjb250YWN0IGFuZCBraWxsIHRoZSB3YXRjaFxuXHR2YXIgdW5iaW5kTGlzdFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBDaGVjayBpZiBhIHNwZWNpZmljIHVpZCBpcyByZXF1ZXN0ZWRcblx0XHRcdGlmKCRyb3V0ZVBhcmFtcy51aWQgJiYgJHJvdXRlUGFyYW1zLmdpZCkge1xuXHRcdFx0XHRjdHJsLmNvbnRhY3RMaXN0LmZvckVhY2goZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdFx0XHRcdGlmKGNvbnRhY3QudWlkKCkgPT09ICRyb3V0ZVBhcmFtcy51aWQpIHtcblx0XHRcdFx0XHRcdGN0cmwuc2V0U2VsZWN0ZWRJZCgkcm91dGVQYXJhbXMudWlkKTtcblx0XHRcdFx0XHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBObyBjb250YWN0IHByZXZpb3VzbHkgbG9hZGVkLCBsZXQncyBsb2FkIHRoZSBmaXJzdCBvZiB0aGUgbGlzdCBpZiBub3QgaW4gbW9iaWxlIG1vZGVcblx0XHRcdGlmKGN0cmwubG9hZGluZyAmJiAkKHdpbmRvdykud2lkdGgoKSA+IDc2OCkge1xuXHRcdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQoY3RybC5jb250YWN0TGlzdFswXS51aWQoKSk7XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdHVuYmluZExpc3RXYXRjaCgpO1xuXHRcdH1cblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC5yb3V0ZVBhcmFtcy51aWQnLCBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcblx0XHQvLyBVc2VkIGZvciBtb2JpbGUgdmlldyB0byBjbGVhciB0aGUgdXJsXG5cdFx0aWYodHlwZW9mIG9sZFZhbHVlICE9ICd1bmRlZmluZWQnICYmIHR5cGVvZiBuZXdWYWx1ZSA9PSAndW5kZWZpbmVkJyAmJiAkKHdpbmRvdykud2lkdGgoKSA8PSA3NjgpIHtcblx0XHRcdC8vIG5vIGNvbnRhY3Qgc2VsZWN0ZWRcblx0XHRcdGN0cmwuc2hvdyA9IHRydWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmKG5ld1ZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIHdlIG1pZ2h0IGhhdmUgdG8gd2FpdCB1bnRpbCBuZy1yZXBlYXQgZmlsbGVkIHRoZSBjb250YWN0TGlzdFxuXHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHdhdGNoIGZvciBuZXh0IGNvbnRhY3RMaXN0IHVwZGF0ZVxuXHRcdFx0XHR2YXIgdW5iaW5kV2F0Y2ggPSAkc2NvcGUuJHdhdGNoKCdjdHJsLmNvbnRhY3RMaXN0JywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHVuYmluZFdhdGNoKCk7IC8vIHVuYmluZCBhcyB3ZSBvbmx5IHdhbnQgb25lIHVwZGF0ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZGlzcGxheWluZyBjb250YWN0IGRldGFpbHNcblx0XHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdH1cblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC5yb3V0ZVBhcmFtcy5naWQnLCBmdW5jdGlvbigpIHtcblx0XHQvLyB3ZSBtaWdodCBoYXZlIHRvIHdhaXQgdW50aWwgbmctcmVwZWF0IGZpbGxlZCB0aGUgY29udGFjdExpc3Rcblx0XHRjdHJsLmNvbnRhY3RMaXN0ID0gW107XG5cdFx0Ly8gbm90IGluIG1vYmlsZSBtb2RlXG5cdFx0aWYoJCh3aW5kb3cpLndpZHRoKCkgPiA3NjgpIHtcblx0XHRcdC8vIHdhdGNoIGZvciBuZXh0IGNvbnRhY3RMaXN0IHVwZGF0ZVxuXHRcdFx0dmFyIHVuYmluZFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZihjdHJsLmNvbnRhY3RMaXN0ICYmIGN0cmwuY29udGFjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0dWlkOiBjdHJsLmNvbnRhY3RMaXN0WzBdLnVpZCgpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dW5iaW5kV2F0Y2goKTsgLy8gdW5iaW5kIGFzIHdlIG9ubHkgd2FudCBvbmUgdXBkYXRlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdhdGNoIGlmIHdlIGhhdmUgYW4gaW52YWxpZCBjb250YWN0XG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3RbMF0uZGlzcGxheU5hbWUoKScsIGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0Y3RybC5pbnZhbGlkID0gKGRpc3BsYXlOYW1lID09PSAnJyk7XG5cdH0pO1xuXG5cdGN0cmwuaGFzQ29udGFjdHMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCFjdHJsLmNvbnRhY3RzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBjdHJsLmNvbnRhY3RzLmxlbmd0aCA+IDA7XG5cdH07XG5cblx0Y3RybC5zZXRTZWxlY3RlZElkID0gZnVuY3Rpb24gKGNvbnRhY3RJZCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0dWlkOiBjb250YWN0SWRcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLmdldFNlbGVjdGVkSWQgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJHJvdXRlUGFyYW1zLnVpZDtcblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdGxpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRwcmlvcml0eTogMSxcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2NvbnRhY3RsaXN0Q3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0YWRkcmVzc2Jvb2s6ICc9YWRyYm9vaydcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0TGlzdC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdkZXRhaWxzSXRlbUN0cmwnLCBmdW5jdGlvbigkdGVtcGxhdGVSZXF1ZXN0LCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCBDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5tZXRhID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGN0cmwubmFtZSk7XG5cdGN0cmwudHlwZSA9IHVuZGVmaW5lZDtcblx0Y3RybC5pc1ByZWZlcnJlZCA9IGZhbHNlO1xuXHRjdHJsLnQgPSB7XG5cdFx0cG9Cb3ggOiB0KCdjb250YWN0cycsICdQb3N0IG9mZmljZSBib3gnKSxcblx0XHRwb3N0YWxDb2RlIDogdCgnY29udGFjdHMnLCAnUG9zdGFsIGNvZGUnKSxcblx0XHRjaXR5IDogdCgnY29udGFjdHMnLCAnQ2l0eScpLFxuXHRcdHN0YXRlIDogdCgnY29udGFjdHMnLCAnU3RhdGUgb3IgcHJvdmluY2UnKSxcblx0XHRjb3VudHJ5IDogdCgnY29udGFjdHMnLCAnQ291bnRyeScpLFxuXHRcdGFkZHJlc3M6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MnKSxcblx0XHRuZXdHcm91cDogdCgnY29udGFjdHMnLCAnKG5ldyBncm91cCknKSxcblx0XHRmYW1pbHlOYW1lOiB0KCdjb250YWN0cycsICdMYXN0IG5hbWUnKSxcblx0XHRmaXJzdE5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZpcnN0IG5hbWUnKSxcblx0XHRhZGRpdGlvbmFsTmFtZXM6IHQoJ2NvbnRhY3RzJywgJ0FkZGl0aW9uYWwgbmFtZXMnKSxcblx0XHRob25vcmlmaWNQcmVmaXg6IHQoJ2NvbnRhY3RzJywgJ1ByZWZpeCcpLFxuXHRcdGhvbm9yaWZpY1N1ZmZpeDogdCgnY29udGFjdHMnLCAnU3VmZml4Jylcblx0fTtcblxuXHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLm1ldGEub3B0aW9ucyB8fCBbXTtcblx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YSkgJiYgIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhLm1ldGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5tZXRhLnR5cGUpKSB7XG5cdFx0Ly8gcGFyc2UgdHlwZSBvZiB0aGUgcHJvcGVydHlcblx0XHR2YXIgYXJyYXkgPSBjdHJsLmRhdGEubWV0YS50eXBlWzBdLnNwbGl0KCcsJyk7XG5cdFx0YXJyYXkgPSBhcnJheS5tYXAoZnVuY3Rpb24gKGVsZW0pIHtcblx0XHRcdHJldHVybiBlbGVtLnRyaW0oKS5yZXBsYWNlKC9cXC8rJC8sICcnKS5yZXBsYWNlKC9cXFxcKyQvLCAnJykudHJpbSgpLnRvVXBwZXJDYXNlKCk7XG5cdFx0fSk7XG5cdFx0Ly8gdGhlIHByZWYgdmFsdWUgaXMgaGFuZGxlZCBvbiBpdHMgb3duIHNvIHRoYXQgd2UgY2FuIGFkZCBzb21lIGZhdm9yaXRlIGljb24gdG8gdGhlIHVpIGlmIHdlIHdhbnRcblx0XHRpZiAoYXJyYXkuaW5kZXhPZignUFJFRicpID49IDApIHtcblx0XHRcdGN0cmwuaXNQcmVmZXJyZWQgPSB0cnVlO1xuXHRcdFx0YXJyYXkuc3BsaWNlKGFycmF5LmluZGV4T2YoJ1BSRUYnKSwgMSk7XG5cdFx0fVxuXHRcdC8vIHNpbXBseSBqb2luIHRoZSB1cHBlciBjYXNlZCB0eXBlcyB0b2dldGhlciBhcyBrZXlcblx0XHRjdHJsLnR5cGUgPSBhcnJheS5qb2luKCcsJyk7XG5cdFx0dmFyIGRpc3BsYXlOYW1lID0gYXJyYXkubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gZWxlbWVudC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIGVsZW1lbnQuc2xpY2UoMSkudG9Mb3dlckNhc2UoKTtcblx0XHR9KS5qb2luKCcgJyk7XG5cblx0XHQvLyBpbiBjYXNlIHRoZSB0eXBlIGlzIG5vdCB5ZXQgaW4gdGhlIGRlZmF1bHQgbGlzdCBvZiBhdmFpbGFibGUgb3B0aW9ucyB3ZSBhZGQgaXRcblx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IGN0cmwudHlwZTsgfSApKSB7XG5cdFx0XHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLmF2YWlsYWJsZU9wdGlvbnMuY29uY2F0KFt7aWQ6IGN0cmwudHlwZSwgbmFtZTogZGlzcGxheU5hbWV9XSk7XG5cdFx0fVxuXHR9XG5cdGlmICghXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEpICYmICFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YS5uYW1lc3BhY2UpKSB7XG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10pKSB7XG5cdFx0XHR2YXIgdmFsID0gXy5maW5kKHRoaXMubW9kZWwuY29udGFjdC5wcm9wc1snWC1BQkxBQkVMJ10sIGZ1bmN0aW9uKHgpIHsgcmV0dXJuIHgubmFtZXNwYWNlID09PSBjdHJsLmRhdGEubmFtZXNwYWNlOyB9KTtcblx0XHRcdGN0cmwudHlwZSA9IHZhbC52YWx1ZTtcblx0XHRcdGlmICghXy5pc1VuZGVmaW5lZCh2YWwpKSB7XG5cdFx0XHRcdC8vIGluIGNhc2UgdGhlIHR5cGUgaXMgbm90IHlldCBpbiB0aGUgZGVmYXVsdCBsaXN0IG9mIGF2YWlsYWJsZSBvcHRpb25zIHdlIGFkZCBpdFxuXHRcdFx0XHRpZiAoIWN0cmwuYXZhaWxhYmxlT3B0aW9ucy5zb21lKGZ1bmN0aW9uKGUpIHsgcmV0dXJuIGUuaWQgPT09IHZhbC52YWx1ZTsgfSApKSB7XG5cdFx0XHRcdFx0Y3RybC5hdmFpbGFibGVPcHRpb25zID0gY3RybC5hdmFpbGFibGVPcHRpb25zLmNvbmNhdChbe2lkOiB2YWwudmFsdWUsIG5hbWU6IHZhbC52YWx1ZX1dKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRjdHJsLmF2YWlsYWJsZUdyb3VwcyA9IFtdO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5hdmFpbGFibGVHcm91cHMgPSBfLnVuaXF1ZShncm91cHMpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZVR5cGUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0aWYgKGN0cmwuaXNQcmVmZXJyZWQpIHtcblx0XHRcdHZhbCArPSAnLFBSRUYnO1xuXHRcdH1cblx0XHRjdHJsLmRhdGEubWV0YSA9IGN0cmwuZGF0YS5tZXRhIHx8IHt9O1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGUgPSBjdHJsLmRhdGEubWV0YS50eXBlIHx8IFtdO1xuXHRcdGN0cmwuZGF0YS5tZXRhLnR5cGVbMF0gPSB2YWw7XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVEZXRhaWxlZE5hbWUgPSBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIGZuID0gJyc7XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVszXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzNdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzFdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbMV0gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbMl0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVsyXSArICcgJztcblx0XHR9XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVswXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzBdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzRdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbNF07XG5cdFx0fVxuXG5cdFx0Y3RybC5tb2RlbC5jb250YWN0LmZ1bGxOYW1lKGZuKTtcblx0XHRjdHJsLm1vZGVsLnVwZGF0ZUNvbnRhY3QoKTtcblx0fTtcblxuXHRjdHJsLmdldFRlbXBsYXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0dmFyIHRlbXBsYXRlVXJsID0gT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZGV0YWlsSXRlbXMvJyArIGN0cmwubWV0YS50ZW1wbGF0ZSArICcuaHRtbCcpO1xuXHRcdHJldHVybiAkdGVtcGxhdGVSZXF1ZXN0KHRlbXBsYXRlVXJsKTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUZpZWxkID0gZnVuY3Rpb24gKCkge1xuXHRcdGN0cmwubW9kZWwuZGVsZXRlRmllbGQoY3RybC5uYW1lLCBjdHJsLmRhdGEpO1xuXHRcdGN0cmwubW9kZWwudXBkYXRlQ29udGFjdCgpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZGV0YWlsc2l0ZW0nLCBbJyRjb21waWxlJywgZnVuY3Rpb24oJGNvbXBpbGUpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2RldGFpbHNJdGVtQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0bmFtZTogJz0nLFxuXHRcdFx0ZGF0YTogJz0nLFxuXHRcdFx0bW9kZWw6ICc9J1xuXHRcdH0sXG5cdFx0bGluazogZnVuY3Rpb24oc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBjdHJsKSB7XG5cdFx0XHRjdHJsLmdldFRlbXBsYXRlKCkudGhlbihmdW5jdGlvbihodG1sKSB7XG5cdFx0XHRcdHZhciB0ZW1wbGF0ZSA9IGFuZ3VsYXIuZWxlbWVudChodG1sKTtcblx0XHRcdFx0ZWxlbWVudC5hcHBlbmQodGVtcGxhdGUpO1xuXHRcdFx0XHQkY29tcGlsZSh0ZW1wbGF0ZSkoc2NvcGUpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufV0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cEN0cmwnLCBmdW5jdGlvbigpIHtcblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVudXNlZC12YXJzXG5cdHZhciBjdHJsID0gdGhpcztcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2dyb3VwJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2dyb3VwQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0Z3JvdXA6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9ncm91cC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdncm91cGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgU2VhcmNoU2VydmljZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHR2YXIgaW5pdGlhbEdyb3VwcyA9IFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV07XG5cblx0Y3RybC5ncm91cHMgPSBpbml0aWFsR3JvdXBzO1xuXG5cdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0Y3RybC5ncm91cHMgPSBfLnVuaXF1ZShpbml0aWFsR3JvdXBzLmNvbmNhdChncm91cHMpKTtcblx0fSk7XG5cblx0Y3RybC5nZXRTZWxlY3RlZCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiAkcm91dGVQYXJhbXMuZ2lkO1xuXHR9O1xuXG5cdC8vIFVwZGF0ZSBncm91cExpc3Qgb24gY29udGFjdCBhZGQvZGVsZXRlL3VwZGF0ZVxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oKSB7XG5cdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdENvbnRhY3RTZXJ2aWNlLmdldEdyb3VwcygpLnRoZW4oZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0XHRcdGN0cmwuZ3JvdXBzID0gXy51bmlxdWUoaW5pdGlhbEdyb3Vwcy5jb25jYXQoZ3JvdXBzKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Y3RybC5zZXRTZWxlY3RlZCA9IGZ1bmN0aW9uIChzZWxlY3RlZEdyb3VwKSB7XG5cdFx0U2VhcmNoU2VydmljZS5jbGVhblNlYXJjaCgpO1xuXHRcdCRyb3V0ZVBhcmFtcy5naWQgPSBzZWxlY3RlZEdyb3VwO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXBsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdncm91cGxpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvZ3JvdXBMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ25ld0NvbnRhY3RCdXR0b25DdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBDb250YWN0U2VydmljZSwgJHJvdXRlUGFyYW1zLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnQgPSB7XG5cdFx0YWRkQ29udGFjdCA6IHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0Jylcblx0fTtcblxuXHRjdHJsLmNyZWF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5jcmVhdGUoKS50aGVuKGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHRcdFsndGVsJywgJ2FkcicsICdlbWFpbCddLmZvckVhY2goZnVuY3Rpb24oZmllbGQpIHtcblx0XHRcdFx0dmFyIGRlZmF1bHRWYWx1ZSA9IHZDYXJkUHJvcGVydGllc1NlcnZpY2UuZ2V0TWV0YShmaWVsZCkuZGVmYXVsdFZhbHVlIHx8IHt2YWx1ZTogJyd9O1xuXHRcdFx0XHRjb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdFx0fSApO1xuXHRcdFx0aWYgKFt0KCdjb250YWN0cycsICdBbGwgY29udGFjdHMnKSwgdCgnY29udGFjdHMnLCAnTm90IGdyb3VwZWQnKV0uaW5kZXhPZigkcm91dGVQYXJhbXMuZ2lkKSA9PT0gLTEpIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCRyb3V0ZVBhcmFtcy5naWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29udGFjdC5jYXRlZ29yaWVzKCcnKTtcblx0XHRcdH1cblx0XHRcdCQoJyNkZXRhaWxzLWZ1bGxOYW1lJykuZm9jdXMoKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ25ld2NvbnRhY3RidXR0b24nLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ25ld0NvbnRhY3RCdXR0b25DdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvbmV3Q29udGFjdEJ1dHRvbi5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2dyb3VwTW9kZWwnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJue1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0cmVxdWlyZTogJ25nTW9kZWwnLFxuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBuZ01vZGVsKSB7XG5cdFx0XHRuZ01vZGVsLiRmb3JtYXR0ZXJzLnB1c2goZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKHZhbHVlLnRyaW0oKS5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHZhbHVlLnNwbGl0KCcsJyk7XG5cdFx0XHR9KTtcblx0XHRcdG5nTW9kZWwuJHBhcnNlcnMucHVzaChmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdmFsdWUuam9pbignLCcpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgndGVsTW9kZWwnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJue1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0cmVxdWlyZTogJ25nTW9kZWwnLFxuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBuZ01vZGVsKSB7XG5cdFx0XHRuZ01vZGVsLiRmb3JtYXR0ZXJzLnB1c2goZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSk7XG5cdFx0XHRuZ01vZGVsLiRwYXJzZXJzLnB1c2goZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZhY3RvcnkoJ0FkZHJlc3NCb29rJywgZnVuY3Rpb24oKVxue1xuXHRyZXR1cm4gZnVuY3Rpb24gQWRkcmVzc0Jvb2soZGF0YSkge1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIHtcblxuXHRcdFx0ZGlzcGxheU5hbWU6ICcnLFxuXHRcdFx0Y29udGFjdHM6IFtdLFxuXHRcdFx0Z3JvdXBzOiBkYXRhLmRhdGEucHJvcHMuZ3JvdXBzLFxuXG5cdFx0XHRnZXRDb250YWN0OiBmdW5jdGlvbih1aWQpIHtcblx0XHRcdFx0Zm9yKHZhciBpIGluIHRoaXMuY29udGFjdHMpIHtcblx0XHRcdFx0XHRpZih0aGlzLmNvbnRhY3RzW2ldLnVpZCgpID09PSB1aWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmNvbnRhY3RzW2ldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblxuXHRcdFx0c2hhcmVkV2l0aDoge1xuXHRcdFx0XHR1c2VyczogW10sXG5cdFx0XHRcdGdyb3VwczogW11cblx0XHRcdH1cblxuXHRcdH0pO1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIGRhdGEpO1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIHtcblx0XHRcdG93bmVyOiBkYXRhLnVybC5zcGxpdCgnLycpLnNsaWNlKC0zLCAtMilbMF1cblx0XHR9KTtcblxuXHRcdHZhciBzaGFyZXMgPSB0aGlzLmRhdGEucHJvcHMuaW52aXRlO1xuXHRcdGlmICh0eXBlb2Ygc2hhcmVzICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBzaGFyZXMubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0dmFyIGhyZWYgPSBzaGFyZXNbal0uaHJlZjtcblx0XHRcdFx0aWYgKGhyZWYubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIGFjY2VzcyA9IHNoYXJlc1tqXS5hY2Nlc3M7XG5cdFx0XHRcdGlmIChhY2Nlc3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgcmVhZFdyaXRlID0gKHR5cGVvZiBhY2Nlc3MucmVhZFdyaXRlICE9PSAndW5kZWZpbmVkJyk7XG5cblx0XHRcdFx0aWYgKGhyZWYuc3RhcnRzV2l0aCgncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJykpIHtcblx0XHRcdFx0XHR0aGlzLnNoYXJlZFdpdGgudXNlcnMucHVzaCh7XG5cdFx0XHRcdFx0XHRpZDogaHJlZi5zdWJzdHIoMjcpLFxuXHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IGhyZWYuc3Vic3RyKDI3KSxcblx0XHRcdFx0XHRcdHdyaXRhYmxlOiByZWFkV3JpdGVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIGlmIChocmVmLnN0YXJ0c1dpdGgoJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nKSkge1xuXHRcdFx0XHRcdHRoaXMuc2hhcmVkV2l0aC5ncm91cHMucHVzaCh7XG5cdFx0XHRcdFx0XHRpZDogaHJlZi5zdWJzdHIoMjgpLFxuXHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IGhyZWYuc3Vic3RyKDI4KSxcblx0XHRcdFx0XHRcdHdyaXRhYmxlOiByZWFkV3JpdGVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vdmFyIG93bmVyID0gdGhpcy5kYXRhLnByb3BzLm93bmVyO1xuXHRcdC8vaWYgKHR5cGVvZiBvd25lciAhPT0gJ3VuZGVmaW5lZCcgJiYgb3duZXIubGVuZ3RoICE9PSAwKSB7XG5cdFx0Ly9cdG93bmVyID0gb3duZXIudHJpbSgpO1xuXHRcdC8vXHRpZiAob3duZXIuc3RhcnRzV2l0aCgnL3JlbW90ZS5waHAvZGF2L3ByaW5jaXBhbHMvdXNlcnMvJykpIHtcblx0XHQvL1x0XHR0aGlzLl9wcm9wZXJ0aWVzLm93bmVyID0gb3duZXIuc3Vic3RyKDMzKTtcblx0XHQvL1x0fVxuXHRcdC8vfVxuXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQ29udGFjdCcsIGZ1bmN0aW9uKCRmaWx0ZXIpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIENvbnRhY3QoYWRkcmVzc0Jvb2ssIHZDYXJkKSB7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXG5cdFx0XHRkYXRhOiB7fSxcblx0XHRcdHByb3BzOiB7fSxcblxuXHRcdFx0ZGF0ZVByb3BlcnRpZXM6IFsnYmRheScsICdhbm5pdmVyc2FyeScsICdkZWF0aGRhdGUnXSxcblxuXHRcdFx0YWRkcmVzc0Jvb2tJZDogYWRkcmVzc0Jvb2suZGlzcGxheU5hbWUsXG5cblx0XHRcdHJldjogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiBtb2RlbC5zZXRQcm9wZXJ0eSgncmV2JywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLmdldFByb3BlcnR5KCdyZXYnKS52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0dWlkOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnNldFByb3BlcnR5KCd1aWQnLCB7IHZhbHVlOiB2YWx1ZSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gbW9kZWwuZ2V0UHJvcGVydHkoJ3VpZCcpLnZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRkaXNwbGF5TmFtZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZ1bGxOYW1lKCkgfHwgdGhpcy5vcmcoKSB8fCAnJztcblx0XHRcdH0sXG5cblx0XHRcdGZ1bGxOYW1lOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgbW9kZWwgPSB0aGlzO1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ2ZuJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gbW9kZWwuZ2V0UHJvcGVydHkoJ2ZuJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cHJvcGVydHkgPSBtb2RlbC5nZXRQcm9wZXJ0eSgnbicpO1xuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuZmlsdGVyKGZ1bmN0aW9uKGVsZW0pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGVsZW07XG5cdFx0XHRcdFx0XHR9KS5qb2luKCcgJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHRpdGxlOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3RpdGxlJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgndGl0bGUnKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0b3JnOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdvcmcnKTtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdHZhciB2YWwgPSB2YWx1ZTtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSAmJiBBcnJheS5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0dmFsID0gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0XHR2YWxbMF0gPSB2YWx1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ29yZycsIHsgdmFsdWU6IHZhbCB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBnZXR0ZXJcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZVswXTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGVtYWlsOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2VtYWlsJyk7XG5cdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdHBob3RvOiBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRpZiAoYW5ndWxhci5pc0RlZmluZWQodmFsdWUpKSB7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0Ly8gc3BsaXRzIGltYWdlIGRhdGEgaW50byBcImRhdGE6aW1hZ2UvanBlZ1wiIGFuZCBiYXNlIDY0IGVuY29kZWQgaW1hZ2Vcblx0XHRcdFx0XHR2YXIgaW1hZ2VEYXRhID0gdmFsdWUuc3BsaXQoJztiYXNlNjQsJyk7XG5cdFx0XHRcdFx0dmFyIGltYWdlVHlwZSA9IGltYWdlRGF0YVswXS5zbGljZSgnZGF0YTonLmxlbmd0aCk7XG5cdFx0XHRcdFx0aWYgKCFpbWFnZVR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aW1hZ2VUeXBlID0gaW1hZ2VUeXBlLnN1YnN0cmluZyg2KS50b1VwcGVyQ2FzZSgpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuc2V0UHJvcGVydHkoJ3Bob3RvJywgeyB2YWx1ZTogaW1hZ2VEYXRhWzFdLCBtZXRhOiB7dHlwZTogW2ltYWdlVHlwZV0sIGVuY29kaW5nOiBbJ2InXX0gfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgncGhvdG8nKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0dmFyIHR5cGUgPSBwcm9wZXJ0eS5tZXRhLnR5cGU7XG5cdFx0XHRcdFx0XHRpZiAoYW5ndWxhci5pc0FycmF5KHR5cGUpKSB7XG5cdFx0XHRcdFx0XHRcdHR5cGUgPSB0eXBlWzBdO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCF0eXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSB7XG5cdFx0XHRcdFx0XHRcdHR5cGUgPSAnaW1hZ2UvJyArIHR5cGUudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiAnZGF0YTonICsgdHlwZSArICc7YmFzZTY0LCcgKyBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdGNhdGVnb3JpZXM6IGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHQvLyBzZXR0ZXJcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZXRQcm9wZXJ0eSgnY2F0ZWdvcmllcycsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSAmJiBwcm9wZXJ0eS52YWx1ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWUuc3BsaXQoJywnKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0Zm9ybWF0RGF0ZUFzUkZDNjM1MDogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChkYXRhKSB8fCBfLmlzVW5kZWZpbmVkKGRhdGEudmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZGF0ZVByb3BlcnRpZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBkYXRhLnZhbHVlLm1hdGNoKC9eKFxcZHs0fSktKFxcZHsyfSktKFxcZHsyfSkkLyk7XG5cdFx0XHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdFx0XHRkYXRhLnZhbHVlID0gbWF0Y2hbMV0gKyBtYXRjaFsyXSArIG1hdGNoWzNdO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBkYXRhO1xuXHRcdFx0fSxcblxuXHRcdFx0Zm9ybWF0RGF0ZUZvckRpc3BsYXk6IGZ1bmN0aW9uKG5hbWUsIGRhdGEpIHtcblx0XHRcdFx0aWYgKF8uaXNVbmRlZmluZWQoZGF0YSkgfHwgXy5pc1VuZGVmaW5lZChkYXRhLnZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybiBkYXRhO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLmRhdGVQcm9wZXJ0aWVzLmluZGV4T2YobmFtZSkgIT09IC0xKSB7XG5cdFx0XHRcdFx0dmFyIG1hdGNoID0gZGF0YS52YWx1ZS5tYXRjaCgvXihcXGR7NH0pKFxcZHsyfSkoXFxkezJ9KSQvKTtcblx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdGRhdGEudmFsdWUgPSBtYXRjaFsxXSArICctJyArIG1hdGNoWzJdICsgJy0nICsgbWF0Y2hbM107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHR9LFxuXG5cdFx0XHRnZXRQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSkge1xuXHRcdFx0XHRpZiAodGhpcy5wcm9wc1tuYW1lXSkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmZvcm1hdERhdGVGb3JEaXNwbGF5KG5hbWUsIHRoaXMucHJvcHNbbmFtZV1bMF0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRhZGRQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRkYXRhID0gYW5ndWxhci5jb3B5KGRhdGEpO1xuXHRcdFx0XHRkYXRhID0gdGhpcy5mb3JtYXREYXRlQXNSRkM2MzUwKG5hbWUsIGRhdGEpO1xuXHRcdFx0XHRpZighdGhpcy5wcm9wc1tuYW1lXSkge1xuXHRcdFx0XHRcdHRoaXMucHJvcHNbbmFtZV0gPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHR2YXIgaWR4ID0gdGhpcy5wcm9wc1tuYW1lXS5sZW5ndGg7XG5cdFx0XHRcdHRoaXMucHJvcHNbbmFtZV1baWR4XSA9IGRhdGE7XG5cblx0XHRcdFx0Ly8ga2VlcCB2Q2FyZCBpbiBzeW5jXG5cdFx0XHRcdHRoaXMuZGF0YS5hZGRyZXNzRGF0YSA9ICRmaWx0ZXIoJ0pTT04ydkNhcmQnKSh0aGlzLnByb3BzKTtcblx0XHRcdFx0cmV0dXJuIGlkeDtcblx0XHRcdH0sXG5cdFx0XHRzZXRQcm9wZXJ0eTogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRpZighdGhpcy5wcm9wc1tuYW1lXSkge1xuXHRcdFx0XHRcdHRoaXMucHJvcHNbbmFtZV0gPSBbXTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkYXRhID0gdGhpcy5mb3JtYXREYXRlQXNSRkM2MzUwKG5hbWUsIGRhdGEpO1xuXHRcdFx0XHR0aGlzLnByb3BzW25hbWVdWzBdID0gZGF0YTtcblxuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZVByb3BlcnR5OiBmdW5jdGlvbiAobmFtZSwgcHJvcCkge1xuXHRcdFx0XHRhbmd1bGFyLmNvcHkoXy53aXRob3V0KHRoaXMucHJvcHNbbmFtZV0sIHByb3ApLCB0aGlzLnByb3BzW25hbWVdKTtcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0fSxcblx0XHRcdHNldEVUYWc6IGZ1bmN0aW9uKGV0YWcpIHtcblx0XHRcdFx0dGhpcy5kYXRhLmV0YWcgPSBldGFnO1xuXHRcdFx0fSxcblx0XHRcdHNldFVybDogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIHVpZCkge1xuXHRcdFx0XHR0aGlzLmRhdGEudXJsID0gYWRkcmVzc0Jvb2sudXJsICsgdWlkICsgJy52Y2YnO1xuXHRcdFx0fSxcblxuXHRcdFx0c3luY1ZDYXJkOiBmdW5jdGlvbigpIHtcblx0XHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHRcdF8uZWFjaCh0aGlzLmRhdGVQcm9wZXJ0aWVzLCBmdW5jdGlvbihuYW1lKSB7XG5cdFx0XHRcdFx0aWYgKCFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV0pICYmICFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV1bMF0pKSB7XG5cdFx0XHRcdFx0XHQvLyBTZXQgZGF0ZXMgYWdhaW4gdG8gbWFrZSBzdXJlIHRoZXkgYXJlIGluIFJGQy02MzUwIGZvcm1hdFxuXHRcdFx0XHRcdFx0c2VsZi5zZXRQcm9wZXJ0eShuYW1lLCBzZWxmLnByb3BzW25hbWVdWzBdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHQvLyBmb3JjZSBmbiB0byBiZSBzZXRcblx0XHRcdFx0dGhpcy5mdWxsTmFtZSh0aGlzLmZ1bGxOYW1lKCkpO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHRzZWxmLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykoc2VsZi5wcm9wcyk7XG5cdFx0XHR9LFxuXG5cdFx0XHRtYXRjaGVzOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKHBhdHRlcm4pIHx8IHBhdHRlcm4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0dmFyIG1hdGNoaW5nUHJvcHMgPSBbJ2ZuJywgJ3RpdGxlJywgJ29yZycsICdlbWFpbCcsICduaWNrbmFtZScsICdub3RlJywgJ3VybCcsICdjbG91ZCcsICdhZHInLCAnaW1wcCcsICd0ZWwnXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BOYW1lKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsLnByb3BzW3Byb3BOYW1lXSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnByb3BzW3Byb3BOYW1lXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRcdGlmICghcHJvcGVydHkudmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKF8uaXNTdHJpbmcocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpICE9PSAtMTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoXy5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS5maWx0ZXIoZnVuY3Rpb24odikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHYudG9Mb3dlckNhc2UoKS5pbmRleE9mKHBhdHRlcm4udG9Mb3dlckNhc2UoKSkgIT09IC0xO1xuXHRcdFx0XHRcdFx0XHRcdH0pLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSkubGVuZ3RoID4gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIG1hdGNoaW5nUHJvcHMubGVuZ3RoID4gMDtcblx0XHRcdH1cblxuXHRcdH0pO1xuXG5cdFx0aWYoYW5ndWxhci5pc0RlZmluZWQodkNhcmQpKSB7XG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLmRhdGEsIHZDYXJkKTtcblx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMucHJvcHMsICRmaWx0ZXIoJ3ZDYXJkMkpTT04nKSh0aGlzLmRhdGEuYWRkcmVzc0RhdGEpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YW5ndWxhci5leHRlbmQodGhpcy5wcm9wcywge1xuXHRcdFx0XHR2ZXJzaW9uOiBbe3ZhbHVlOiAnMy4wJ31dLFxuXHRcdFx0XHRmbjogW3t2YWx1ZTogJyd9XVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0fVxuXG5cdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnY2F0ZWdvcmllcycpO1xuXHRcdGlmKCFwcm9wZXJ0eSkge1xuXHRcdFx0dGhpcy5jYXRlZ29yaWVzKCcnKTtcblx0XHR9XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQWRkcmVzc0Jvb2tTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50LCBEYXZTZXJ2aWNlLCBTZXR0aW5nc1NlcnZpY2UsIEFkZHJlc3NCb29rLCAkcSkge1xuXG5cdHZhciBhZGRyZXNzQm9va3MgPSBbXTtcblx0dmFyIGxvYWRQcm9taXNlID0gdW5kZWZpbmVkO1xuXG5cdHZhciBsb2FkQWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKGFkZHJlc3NCb29rcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihhZGRyZXNzQm9va3MpO1xuXHRcdH1cblx0XHRpZiAoXy5pc1VuZGVmaW5lZChsb2FkUHJvbWlzZSkpIHtcblx0XHRcdGxvYWRQcm9taXNlID0gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0bG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGFkZHJlc3NCb29rcyA9IGFjY291bnQuYWRkcmVzc0Jvb2tzLm1hcChmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQWRkcmVzc0Jvb2soYWRkcmVzc0Jvb2spO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9hZFByb21pc2U7XG5cdH07XG5cblx0cmV0dXJuIHtcblx0XHRnZXRBbGw6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGxvYWRBbGwoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2tzO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGdldEdyb3VwczogZnVuY3Rpb24gKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcy5tYXAoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5ncm91cHM7XG5cdFx0XHRcdH0pLnJlZHVjZShmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGEuY29uY2F0KGIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRnZXREZWZhdWx0QWRkcmVzc0Jvb2s6IGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rc1swXTtcblx0XHR9LFxuXG5cdFx0Z2V0QWRkcmVzc0Jvb2s6IGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5nZXRBZGRyZXNzQm9vayh7ZGlzcGxheU5hbWU6ZGlzcGxheU5hbWUsIHVybDphY2NvdW50LmhvbWVVcmx9KS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2sgPSBuZXcgQWRkcmVzc0Jvb2soe1xuXHRcdFx0XHRcdFx0dXJsOiBhZGRyZXNzQm9va1swXS5ocmVmLFxuXHRcdFx0XHRcdFx0ZGF0YTogYWRkcmVzc0Jvb2tbMF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRhZGRyZXNzQm9vay5kaXNwbGF5TmFtZSA9IGRpc3BsYXlOYW1lO1xuXHRcdFx0XHRcdHJldHVybiBhZGRyZXNzQm9vaztcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Y3JlYXRlOiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbihhY2NvdW50KSB7XG5cdFx0XHRcdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWRkcmVzc0Jvb2soe2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0ZGVsZXRlOiBmdW5jdGlvbihhZGRyZXNzQm9vaykge1xuXHRcdFx0cmV0dXJuIERhdlNlcnZpY2UudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5kZWxldGVBZGRyZXNzQm9vayhhZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0XHR2YXIgaW5kZXggPSBhZGRyZXNzQm9va3MuaW5kZXhPZihhZGRyZXNzQm9vayk7XG5cdFx0XHRcdFx0YWRkcmVzc0Jvb2tzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdHJlbmFtZTogZnVuY3Rpb24oYWRkcmVzc0Jvb2ssIGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5yZW5hbWVBZGRyZXNzQm9vayhhZGRyZXNzQm9vaywge2Rpc3BsYXlOYW1lOmRpc3BsYXlOYW1lLCB1cmw6YWNjb3VudC5ob21lVXJsfSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Z2V0OiBmdW5jdGlvbihkaXNwbGF5TmFtZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihhZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rcy5maWx0ZXIoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5kaXNwbGF5TmFtZSA9PT0gZGlzcGxheU5hbWU7XG5cdFx0XHRcdH0pWzBdO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdHN5bmM6IGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50LnN5bmNBZGRyZXNzQm9vayhhZGRyZXNzQm9vayk7XG5cdFx0fSxcblxuXHRcdHNoYXJlOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgc2hhcmVUeXBlLCBzaGFyZVdpdGgsIHdyaXRhYmxlLCBleGlzdGluZ1NoYXJlKSB7XG5cdFx0XHR2YXIgeG1sRG9jID0gZG9jdW1lbnQuaW1wbGVtZW50YXRpb24uY3JlYXRlRG9jdW1lbnQoJycsICcnLCBudWxsKTtcblx0XHRcdHZhciBvU2hhcmUgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpzaGFyZScpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6ZCcsICdEQVY6Jyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpvJywgJ2h0dHA6Ly9vd25jbG91ZC5vcmcvbnMnKTtcblx0XHRcdHhtbERvYy5hcHBlbmRDaGlsZChvU2hhcmUpO1xuXG5cdFx0XHR2YXIgb1NldCA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNldCcpO1xuXHRcdFx0b1NoYXJlLmFwcGVuZENoaWxkKG9TZXQpO1xuXG5cdFx0XHR2YXIgZEhyZWYgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnZDpocmVmJyk7XG5cdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJztcblx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nO1xuXHRcdFx0fVxuXHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgKz0gc2hhcmVXaXRoO1xuXHRcdFx0b1NldC5hcHBlbmRDaGlsZChkSHJlZik7XG5cblx0XHRcdHZhciBvU3VtbWFyeSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnN1bW1hcnknKTtcblx0XHRcdG9TdW1tYXJ5LnRleHRDb250ZW50ID0gdCgnY29udGFjdHMnLCAne2FkZHJlc3Nib29rfSBzaGFyZWQgYnkge293bmVyfScsIHtcblx0XHRcdFx0YWRkcmVzc2Jvb2s6IGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRvd25lcjogYWRkcmVzc0Jvb2sub3duZXJcblx0XHRcdH0pO1xuXHRcdFx0b1NldC5hcHBlbmRDaGlsZChvU3VtbWFyeSk7XG5cblx0XHRcdGlmICh3cml0YWJsZSkge1xuXHRcdFx0XHR2YXIgb1JXID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286cmVhZC13cml0ZScpO1xuXHRcdFx0XHRvU2V0LmFwcGVuZENoaWxkKG9SVyk7XG5cdFx0XHR9XG5cblx0XHRcdHZhciBib2R5ID0gb1NoYXJlLm91dGVySFRNTDtcblxuXHRcdFx0cmV0dXJuIERhdkNsaWVudC54aHIuc2VuZChcblx0XHRcdFx0ZGF2LnJlcXVlc3QuYmFzaWMoe21ldGhvZDogJ1BPU1QnLCBkYXRhOiBib2R5fSksXG5cdFx0XHRcdGFkZHJlc3NCb29rLnVybFxuXHRcdFx0KS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG5cdFx0XHRcdGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwMCkge1xuXHRcdFx0XHRcdGlmICghZXhpc3RpbmdTaGFyZSkge1xuXHRcdFx0XHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdHdyaXRhYmxlOiB3cml0YWJsZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQKSB7XG5cdFx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHR3cml0YWJsZTogd3JpdGFibGVcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH0sXG5cblx0XHR1bnNoYXJlOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgc2hhcmVUeXBlLCBzaGFyZVdpdGgpIHtcblx0XHRcdHZhciB4bWxEb2MgPSBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVEb2N1bWVudCgnJywgJycsIG51bGwpO1xuXHRcdFx0dmFyIG9TaGFyZSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNoYXJlJyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpkJywgJ0RBVjonKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOm8nLCAnaHR0cDovL293bmNsb3VkLm9yZy9ucycpO1xuXHRcdFx0eG1sRG9jLmFwcGVuZENoaWxkKG9TaGFyZSk7XG5cblx0XHRcdHZhciBvUmVtb3ZlID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286cmVtb3ZlJyk7XG5cdFx0XHRvU2hhcmUuYXBwZW5kQ2hpbGQob1JlbW92ZSk7XG5cblx0XHRcdHZhciBkSHJlZiA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdkOmhyZWYnKTtcblx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nO1xuXHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLyc7XG5cdFx0XHR9XG5cdFx0XHRkSHJlZi50ZXh0Q29udGVudCArPSBzaGFyZVdpdGg7XG5cdFx0XHRvUmVtb3ZlLmFwcGVuZENoaWxkKGRIcmVmKTtcblx0XHRcdHZhciBib2R5ID0gb1NoYXJlLm91dGVySFRNTDtcblxuXG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50Lnhoci5zZW5kKFxuXHRcdFx0XHRkYXYucmVxdWVzdC5iYXNpYyh7bWV0aG9kOiAnUE9TVCcsIGRhdGE6IGJvZHl9KSxcblx0XHRcdFx0YWRkcmVzc0Jvb2sudXJsXG5cdFx0XHQpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdFx0XHRhZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzID0gYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycy5maWx0ZXIoZnVuY3Rpb24odXNlcikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdXNlci5pZCAhPT0gc2hhcmVXaXRoO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGguZ3JvdXBzID0gYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC5ncm91cHMuZmlsdGVyKGZ1bmN0aW9uKGdyb3Vwcykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZ3JvdXBzLmlkICE9PSBzaGFyZVdpdGg7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Ly90b2RvIC0gcmVtb3ZlIGVudHJ5IGZyb20gYWRkcmVzc2Jvb2sgb2JqZWN0XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdH1cblxuXG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdDb250YWN0U2VydmljZScsIGZ1bmN0aW9uKERhdkNsaWVudCwgQWRkcmVzc0Jvb2tTZXJ2aWNlLCBDb250YWN0LCAkcSwgQ2FjaGVGYWN0b3J5LCB1dWlkNCkge1xuXG5cdHZhciBjYWNoZUZpbGxlZCA9IGZhbHNlO1xuXG5cdHZhciBjb250YWN0cyA9IENhY2hlRmFjdG9yeSgnY29udGFjdHMnKTtcblxuXHR2YXIgb2JzZXJ2ZXJDYWxsYmFja3MgPSBbXTtcblxuXHR2YXIgbG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUsIHVpZCkge1xuXHRcdHZhciBldiA9IHtcblx0XHRcdGV2ZW50OiBldmVudE5hbWUsXG5cdFx0XHR1aWQ6IHVpZCxcblx0XHRcdGNvbnRhY3RzOiBjb250YWN0cy52YWx1ZXMoKVxuXHRcdH07XG5cdFx0YW5ndWxhci5mb3JFYWNoKG9ic2VydmVyQ2FsbGJhY2tzLCBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2soZXYpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZmlsbENhY2hlID0gZnVuY3Rpb24oKSB7XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobG9hZFByb21pc2UpKSB7XG5cdFx0XHRsb2FkUHJvbWlzZSA9IEFkZHJlc3NCb29rU2VydmljZS5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uIChlbmFibGVkQWRkcmVzc0Jvb2tzKSB7XG5cdFx0XHRcdHZhciBwcm9taXNlcyA9IFtdO1xuXHRcdFx0XHRlbmFibGVkQWRkcmVzc0Jvb2tzLmZvckVhY2goZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0cHJvbWlzZXMucHVzaChcblx0XHRcdFx0XHRcdEFkZHJlc3NCb29rU2VydmljZS5zeW5jKGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uIChhZGRyZXNzQm9vaykge1xuXHRcdFx0XHRcdFx0XHRmb3IgKHZhciBpIGluIGFkZHJlc3NCb29rLm9iamVjdHMpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAoYWRkcmVzc0Jvb2sub2JqZWN0c1tpXS5hZGRyZXNzRGF0YSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0dmFyIGNvbnRhY3QgPSBuZXcgQ29udGFjdChhZGRyZXNzQm9vaywgYWRkcmVzc0Jvb2sub2JqZWN0c1tpXSk7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb250YWN0cy5wdXQoY29udGFjdC51aWQoKSwgY29udGFjdCk7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIGN1c3RvbSBjb25zb2xlXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zb2xlLmxvZygnSW52YWxpZCBjb250YWN0IHJlY2VpdmVkOiAnICsgYWRkcmVzc0Jvb2sub2JqZWN0c1tpXS51cmwpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSlcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuICRxLmFsbChwcm9taXNlcykudGhlbihmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0Y2FjaGVGaWxsZWQgPSB0cnVlO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9hZFByb21pc2U7XG5cdH07XG5cblx0dGhpcy5nZXRBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRpZihjYWNoZUZpbGxlZCA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiB0aGlzLmZpbGxDYWNoZSgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBjb250YWN0cy52YWx1ZXMoKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJHEud2hlbihjb250YWN0cy52YWx1ZXMoKSk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0R3JvdXBzID0gZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRcdHJldHVybiBfLnVuaXEoY29udGFjdHMubWFwKGZ1bmN0aW9uIChlbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybiBlbGVtZW50LmNhdGVnb3JpZXMoKTtcblx0XHRcdH0pLnJlZHVjZShmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRcdHJldHVybiBhLmNvbmNhdChiKTtcblx0XHRcdH0sIFtdKS5zb3J0KCksIHRydWUpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuZ2V0QnlJZCA9IGZ1bmN0aW9uKHVpZCkge1xuXHRcdGlmKGNhY2hlRmlsbGVkID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsbENhY2hlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRhY3RzLmdldCh1aWQpO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAkcS53aGVuKGNvbnRhY3RzLmdldCh1aWQpKTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5jcmVhdGUgPSBmdW5jdGlvbihuZXdDb250YWN0LCBhZGRyZXNzQm9vaywgdWlkKSB7XG5cdFx0YWRkcmVzc0Jvb2sgPSBhZGRyZXNzQm9vayB8fCBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0RGVmYXVsdEFkZHJlc3NCb29rKCk7XG5cdFx0bmV3Q29udGFjdCA9IG5ld0NvbnRhY3QgfHwgbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2spO1xuXHRcdHZhciBuZXdVaWQgPSAnJztcblx0XHRpZih1dWlkNC52YWxpZGF0ZSh1aWQpKSB7XG5cdFx0XHRuZXdVaWQgPSB1aWQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG5ld1VpZCA9IHV1aWQ0LmdlbmVyYXRlKCk7XG5cdFx0fVxuXHRcdG5ld0NvbnRhY3QudWlkKG5ld1VpZCk7XG5cdFx0bmV3Q29udGFjdC5zZXRVcmwoYWRkcmVzc0Jvb2ssIG5ld1VpZCk7XG5cdFx0bmV3Q29udGFjdC5hZGRyZXNzQm9va0lkID0gYWRkcmVzc0Jvb2suZGlzcGxheU5hbWU7XG5cdFx0aWYgKF8uaXNVbmRlZmluZWQobmV3Q29udGFjdC5mdWxsTmFtZSgpKSB8fCBuZXdDb250YWN0LmZ1bGxOYW1lKCkgPT09ICcnKSB7XG5cdFx0XHRuZXdDb250YWN0LmZ1bGxOYW1lKHQoJ2NvbnRhY3RzJywgJ05ldyBjb250YWN0JykpO1xuXHRcdH1cblxuXHRcdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQ2FyZChcblx0XHRcdGFkZHJlc3NCb29rLFxuXHRcdFx0e1xuXHRcdFx0XHRkYXRhOiBuZXdDb250YWN0LmRhdGEuYWRkcmVzc0RhdGEsXG5cdFx0XHRcdGZpbGVuYW1lOiBuZXdVaWQgKyAnLnZjZidcblx0XHRcdH1cblx0XHQpLnRoZW4oZnVuY3Rpb24oeGhyKSB7XG5cdFx0XHRuZXdDb250YWN0LnNldEVUYWcoeGhyLmdldFJlc3BvbnNlSGVhZGVyKCdFVGFnJykpO1xuXHRcdFx0Y29udGFjdHMucHV0KG5ld1VpZCwgbmV3Q29udGFjdCk7XG5cdFx0XHRub3RpZnlPYnNlcnZlcnMoJ2NyZWF0ZScsIG5ld1VpZCk7XG5cdFx0XHRyZXR1cm4gbmV3Q29udGFjdDtcblx0XHR9KS5jYXRjaChmdW5jdGlvbihlKSB7XG5cdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdDb250YWN0IGNvdWxkIG5vdCBiZSBjcmVhdGVkLicpKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmltcG9ydCA9IGZ1bmN0aW9uKGRhdGEsIHR5cGUsIGFkZHJlc3NCb29rLCBwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0YWRkcmVzc0Jvb2sgPSBhZGRyZXNzQm9vayB8fCBBZGRyZXNzQm9va1NlcnZpY2UuZ2V0RGVmYXVsdEFkZHJlc3NCb29rKCk7XG5cblx0XHR2YXIgcmVnZXhwID0gL0JFR0lOOlZDQVJEW1xcc1xcU10qP0VORDpWQ0FSRC9tZ2k7XG5cdFx0dmFyIHNpbmdsZVZDYXJkcyA9IGRhdGEubWF0Y2gocmVnZXhwKTtcblxuXHRcdGlmICghc2luZ2xlVkNhcmRzKSB7XG5cdFx0XHRPQy5Ob3RpZmljYXRpb24uc2hvd1RlbXBvcmFyeSh0KCdjb250YWN0cycsICdObyBjb250YWN0cyBpbiBmaWxlLiBPbmx5IFZDYXJkIGZpbGVzIGFyZSBhbGxvd2VkLicpKTtcblx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0XHRcdHByb2dyZXNzQ2FsbGJhY2soMSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHZhciBudW0gPSAxO1xuXHRcdGZvcih2YXIgaSBpbiBzaW5nbGVWQ2FyZHMpIHtcblx0XHRcdHZhciBuZXdDb250YWN0ID0gbmV3IENvbnRhY3QoYWRkcmVzc0Jvb2ssIHthZGRyZXNzRGF0YTogc2luZ2xlVkNhcmRzW2ldfSk7XG5cdFx0XHR0aGlzLmNyZWF0ZShuZXdDb250YWN0LCBhZGRyZXNzQm9vaykudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0Ly8gVXBkYXRlIHRoZSBwcm9ncmVzcyBpbmRpY2F0b3Jcblx0XHRcdFx0aWYgKHByb2dyZXNzQ2FsbGJhY2spIHByb2dyZXNzQ2FsbGJhY2sobnVtL3NpbmdsZVZDYXJkcy5sZW5ndGgpO1xuXHRcdFx0XHRudW0rKztcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLm1vdmVDb250YWN0ID0gZnVuY3Rpb24gKGNvbnRhY3QsIGFkZHJlc3Nib29rKSB7XG5cdFx0aWYgKGNvbnRhY3QuYWRkcmVzc0Jvb2tJZCA9PT0gYWRkcmVzc2Jvb2suZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udGFjdC5zeW5jVkNhcmQoKTtcblx0XHR2YXIgY2xvbmUgPSBhbmd1bGFyLmNvcHkoY29udGFjdCk7XG5cdFx0dmFyIHVpZCA9IGNvbnRhY3QudWlkKCk7XG5cblx0XHQvLyBkZWxldGUgdGhlIG9sZCBvbmUgYmVmb3JlIHRvIGF2b2lkIGNvbmZsaWN0XG5cdFx0dGhpcy5kZWxldGUoY29udGFjdCk7XG5cblx0XHQvLyBjcmVhdGUgdGhlIGNvbnRhY3QgaW4gdGhlIG5ldyB0YXJnZXQgYWRkcmVzc2Jvb2tcblx0XHR0aGlzLmNyZWF0ZShjbG9uZSwgYWRkcmVzc2Jvb2ssIHVpZCk7XG5cdH07XG5cblx0dGhpcy51cGRhdGUgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0Ly8gdXBkYXRlIHJldiBmaWVsZFxuXHRcdGNvbnRhY3QucmV2KG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSk7XG5cblx0XHRjb250YWN0LnN5bmNWQ2FyZCgpO1xuXG5cdFx0Ly8gdXBkYXRlIGNvbnRhY3Qgb24gc2VydmVyXG5cdFx0cmV0dXJuIERhdkNsaWVudC51cGRhdGVDYXJkKGNvbnRhY3QuZGF0YSwge2pzb246IHRydWV9KS50aGVuKGZ1bmN0aW9uKHhocikge1xuXHRcdFx0dmFyIG5ld0V0YWcgPSB4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0VUYWcnKTtcblx0XHRcdGNvbnRhY3Quc2V0RVRhZyhuZXdFdGFnKTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygndXBkYXRlJywgY29udGFjdC51aWQoKSk7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5kZWxldGUgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0Ly8gZGVsZXRlIGNvbnRhY3QgZnJvbSBzZXJ2ZXJcblx0XHRyZXR1cm4gRGF2Q2xpZW50LmRlbGV0ZUNhcmQoY29udGFjdC5kYXRhKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0Y29udGFjdHMucmVtb3ZlKGNvbnRhY3QudWlkKCkpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdkZWxldGUnLCBjb250YWN0LnVpZCgpKTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZDbGllbnQnLCBmdW5jdGlvbigpIHtcblx0dmFyIHhociA9IG5ldyBkYXYudHJhbnNwb3J0LkJhc2ljKFxuXHRcdG5ldyBkYXYuQ3JlZGVudGlhbHMoKVxuXHQpO1xuXHRyZXR1cm4gbmV3IGRhdi5DbGllbnQoeGhyKTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdEYXZTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50KSB7XG5cdHJldHVybiBEYXZDbGllbnQuY3JlYXRlQWNjb3VudCh7XG5cdFx0c2VydmVyOiBPQy5saW5rVG9SZW1vdGUoJ2Rhdi9hZGRyZXNzYm9va3MnKSxcblx0XHRhY2NvdW50VHlwZTogJ2NhcmRkYXYnLFxuXHRcdHVzZVByb3ZpZGVkUGF0aDogdHJ1ZVxuXHR9KTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZWFyY2hTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdHZhciBzZWFyY2hUZXJtID0gJyc7XG5cblx0dmFyIG9ic2VydmVyQ2FsbGJhY2tzID0gW107XG5cblx0dGhpcy5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdG9ic2VydmVyQ2FsbGJhY2tzLnB1c2goY2FsbGJhY2spO1xuXHR9O1xuXG5cdHZhciBub3RpZnlPYnNlcnZlcnMgPSBmdW5jdGlvbihldmVudE5hbWUpIHtcblx0XHR2YXIgZXYgPSB7XG5cdFx0XHRldmVudDpldmVudE5hbWUsXG5cdFx0XHRzZWFyY2hUZXJtOnNlYXJjaFRlcm1cblx0XHR9O1xuXHRcdGFuZ3VsYXIuZm9yRWFjaChvYnNlcnZlckNhbGxiYWNrcywgZnVuY3Rpb24oY2FsbGJhY2spIHtcblx0XHRcdGNhbGxiYWNrKGV2KTtcblx0XHR9KTtcblx0fTtcblxuXHR2YXIgU2VhcmNoUHJveHkgPSB7XG5cdFx0YXR0YWNoOiBmdW5jdGlvbihzZWFyY2gpIHtcblx0XHRcdHNlYXJjaC5zZXRGaWx0ZXIoJ2NvbnRhY3RzJywgdGhpcy5maWx0ZXJQcm94eSk7XG5cdFx0fSxcblx0XHRmaWx0ZXJQcm94eTogZnVuY3Rpb24ocXVlcnkpIHtcblx0XHRcdHNlYXJjaFRlcm0gPSBxdWVyeTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnY2hhbmdlU2VhcmNoJyk7XG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZ2V0U2VhcmNoVGVybSA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZWFyY2hUZXJtO1xuXHR9O1xuXG5cdHRoaXMuY2xlYW5TZWFyY2ggPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoJCgnLnNlYXJjaGJveCcpKSkge1xuXHRcdFx0JCgnLnNlYXJjaGJveCcpWzBdLnJlc2V0KCk7XG5cdFx0fVxuXHRcdHNlYXJjaFRlcm0gPSAnJztcblx0fTtcblxuXHRpZiAoIV8uaXNVbmRlZmluZWQoT0MuUGx1Z2lucykpIHtcblx0XHRPQy5QbHVnaW5zLnJlZ2lzdGVyKCdPQ0EuU2VhcmNoJywgU2VhcmNoUHJveHkpO1xuXHRcdGlmICghXy5pc1VuZGVmaW5lZChPQ0EuU2VhcmNoKSkge1xuXHRcdFx0T0MuU2VhcmNoID0gbmV3IE9DQS5TZWFyY2goJCgnI3NlYXJjaGJveCcpLCAkKCcjc2VhcmNocmVzdWx0cycpKTtcblx0XHRcdCQoJyNzZWFyY2hib3gnKS5zaG93KCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFfLmlzVW5kZWZpbmVkKCQoJy5zZWFyY2hib3gnKSkpIHtcblx0XHQkKCcuc2VhcmNoYm94JylbMF0uYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBmdW5jdGlvbihlKSB7XG5cdFx0XHRpZihlLmtleUNvZGUgPT09IDEzKSB7XG5cdFx0XHRcdG5vdGlmeU9ic2VydmVycygnc3VibWl0U2VhcmNoJyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCdTZXR0aW5nc1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0dmFyIHNldHRpbmdzID0ge1xuXHRcdGFkZHJlc3NCb29rczogW1xuXHRcdFx0J3Rlc3RBZGRyJ1xuXHRcdF1cblx0fTtcblxuXHR0aGlzLnNldCA9IGZ1bmN0aW9uKGtleSwgdmFsdWUpIHtcblx0XHRzZXR0aW5nc1trZXldID0gdmFsdWU7XG5cdH07XG5cblx0dGhpcy5nZXQgPSBmdW5jdGlvbihrZXkpIHtcblx0XHRyZXR1cm4gc2V0dGluZ3Nba2V5XTtcblx0fTtcblxuXHR0aGlzLmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdHJldHVybiBzZXR0aW5ncztcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5zZXJ2aWNlKCd2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlJywgZnVuY3Rpb24oKSB7XG5cdC8qKlxuXHQgKiBtYXAgdkNhcmQgYXR0cmlidXRlcyB0byBpbnRlcm5hbCBhdHRyaWJ1dGVzXG5cdCAqXG5cdCAqIHByb3BOYW1lOiB7XG5cdCAqIFx0XHRtdWx0aXBsZTogW0Jvb2xlYW5dLCAvLyBpcyB0aGlzIHByb3AgYWxsb3dlZCBtb3JlIHRoYW4gb25jZT8gKGRlZmF1bHQgPSBmYWxzZSlcblx0ICogXHRcdHJlYWRhYmxlTmFtZTogW1N0cmluZ10sIC8vIGludGVybmF0aW9uYWxpemVkIHJlYWRhYmxlIG5hbWUgb2YgcHJvcFxuXHQgKiBcdFx0dGVtcGxhdGU6IFtTdHJpbmddLCAvLyB0ZW1wbGF0ZSBuYW1lIGZvdW5kIGluIC90ZW1wbGF0ZXMvZGV0YWlsSXRlbXNcblx0ICogXHRcdFsuLi5dIC8vIG9wdGlvbmFsIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gd2hpY2ggbWlnaHQgZ2V0IHVzZWQgYnkgdGhlIHRlbXBsYXRlXG5cdCAqIH1cblx0ICovXG5cdHRoaXMudkNhcmRNZXRhID0ge1xuXHRcdG5pY2tuYW1lOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ05pY2tuYW1lJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnXG5cdFx0fSxcblx0XHRuOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0RldGFpbGVkIG5hbWUnKSxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJycsICcnLCAnJywgJycsICcnXVxuXHRcdFx0fSxcblx0XHRcdHRlbXBsYXRlOiAnbidcblx0XHR9LFxuXHRcdG5vdGU6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnTm90ZXMnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dGFyZWEnXG5cdFx0fSxcblx0XHR1cmw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdXZWJzaXRlJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3VybCdcblx0XHR9LFxuXHRcdGNsb3VkOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRmVkZXJhdGVkIENsb3VkIElEJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cdFx0fSxcblx0XHRhZHI6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdBZGRyZXNzJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2FkcicsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnLCAnJywgJycsICcnLCAnJywgJycsICcnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0Y2F0ZWdvcmllczoge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdHcm91cHMnKSxcblx0XHRcdHRlbXBsYXRlOiAnZ3JvdXBzJ1xuXHRcdH0sXG5cdFx0YmRheToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdCaXJ0aGRheScpLFxuXHRcdFx0dGVtcGxhdGU6ICdkYXRlJ1xuXHRcdH0sXG5cdFx0YW5uaXZlcnNhcnk6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnQW5uaXZlcnNhcnknKSxcblx0XHRcdHRlbXBsYXRlOiAnZGF0ZSdcblx0XHR9LFxuXHRcdGRlYXRoZGF0ZToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdEYXRlIG9mIGRlYXRoJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2RhdGUnXG5cdFx0fSxcblx0XHRlbWFpbDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0VtYWlsJyksXG5cdFx0XHR0ZW1wbGF0ZTogJ3RleHQnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOicnLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRpbXBwOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnSW5zdGFudCBtZXNzYWdpbmcnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0dGVsOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnUGhvbmUnKSxcblx0XHRcdHRlbXBsYXRlOiAndGVsJyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSxWT0lDRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRSxWT0lDRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUkssVk9JQ0UnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdDRUxMJywgbmFtZTogdCgnY29udGFjdHMnLCAnTW9iaWxlJyl9LFxuXHRcdFx0XHR7aWQ6ICdGQVgnLCBuYW1lOiB0KCdjb250YWN0cycsICdGYXgnKX0sXG5cdFx0XHRcdHtpZDogJ0hPTUUsRkFYJywgbmFtZTogdCgnY29udGFjdHMnLCAnRmF4IGhvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUkssRkFYJywgbmFtZTogdCgnY29udGFjdHMnLCAnRmF4IHdvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ1BBR0VSJywgbmFtZTogdCgnY29udGFjdHMnLCAnUGFnZXInKX0sXG5cdFx0XHRcdHtpZDogJ1ZPSUNFJywgbmFtZTogdCgnY29udGFjdHMnLCAnVm9pY2UnKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdCdYLVNPQ0lBTFBST0ZJTEUnOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnU29jaWFsIG5ldHdvcmsnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ2ZhY2Vib29rJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdGQUNFQk9PSycsIG5hbWU6ICdGYWNlYm9vayd9LFxuXHRcdFx0XHR7aWQ6ICdUV0lUVEVSJywgbmFtZTogJ1R3aXR0ZXInfVxuXHRcdFx0XVxuXG5cdFx0fVxuXHR9O1xuXG5cdHRoaXMuZmllbGRPcmRlciA9IFtcblx0XHQnb3JnJyxcblx0XHQndGl0bGUnLFxuXHRcdCd0ZWwnLFxuXHRcdCdlbWFpbCcsXG5cdFx0J2FkcicsXG5cdFx0J2ltcHAnLFxuXHRcdCduaWNrJyxcblx0XHQnYmRheScsXG5cdFx0J2Fubml2ZXJzYXJ5Jyxcblx0XHQnZGVhdGhkYXRlJyxcblx0XHQndXJsJyxcblx0XHQnWC1TT0NJQUxQUk9GSUxFJyxcblx0XHQnbm90ZScsXG5cdFx0J2NhdGVnb3JpZXMnLFxuXHRcdCdyb2xlJ1xuXHRdO1xuXG5cdHRoaXMuZmllbGREZWZpbml0aW9ucyA9IFtdO1xuXHRmb3IgKHZhciBwcm9wIGluIHRoaXMudkNhcmRNZXRhKSB7XG5cdFx0dGhpcy5maWVsZERlZmluaXRpb25zLnB1c2goe2lkOiBwcm9wLCBuYW1lOiB0aGlzLnZDYXJkTWV0YVtwcm9wXS5yZWFkYWJsZU5hbWUsIG11bHRpcGxlOiAhIXRoaXMudkNhcmRNZXRhW3Byb3BdLm11bHRpcGxlfSk7XG5cdH1cblxuXHR0aGlzLmZhbGxiYWNrTWV0YSA9IGZ1bmN0aW9uKHByb3BlcnR5KSB7XG5cdFx0ZnVuY3Rpb24gY2FwaXRhbGl6ZShzdHJpbmcpIHsgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTsgfVxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiAndW5rbm93bi0nICsgcHJvcGVydHksXG5cdFx0XHRyZWFkYWJsZU5hbWU6IGNhcGl0YWxpemUocHJvcGVydHkpLFxuXHRcdFx0dGVtcGxhdGU6ICdoaWRkZW4nLFxuXHRcdFx0bmVjZXNzaXR5OiAnb3B0aW9uYWwnXG5cdFx0fTtcblx0fTtcblxuXHR0aGlzLmdldE1ldGEgPSBmdW5jdGlvbihwcm9wZXJ0eSkge1xuXHRcdHJldHVybiB0aGlzLnZDYXJkTWV0YVtwcm9wZXJ0eV0gfHwgdGhpcy5mYWxsYmFja01ldGEocHJvcGVydHkpO1xuXHR9O1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdKU09OMnZDYXJkJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiB2Q2FyZC5nZW5lcmF0ZShpbnB1dCk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdjb250YWN0Q29sb3InLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0Ly8gQ2hlY2sgaWYgY29yZSBoYXMgdGhlIG5ldyBjb2xvciBnZW5lcmF0b3Jcblx0XHRpZih0eXBlb2YgaW5wdXQudG9Ic2wgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHZhciBoc2wgPSBpbnB1dC50b0hzbCgpO1xuXHRcdFx0cmV0dXJuICdoc2woJytoc2xbMF0rJywgJytoc2xbMV0rJyUsICcraHNsWzJdKyclKSc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIElmIG5vdCwgd2UgdXNlIHRoZSBvbGQgb25lXG5cdFx0XHQvKiBnbG9iYWwgbWQ1ICovXG5cdFx0XHR2YXIgaGFzaCA9IG1kNShpbnB1dCkuc3Vic3RyaW5nKDAsIDQpLFxuXHRcdFx0XHRtYXhSYW5nZSA9IHBhcnNlSW50KCdmZmZmJywgMTYpLFxuXHRcdFx0XHRodWUgPSBwYXJzZUludChoYXNoLCAxNikgLyBtYXhSYW5nZSAqIDI1Njtcblx0XHRcdHJldHVybiAnaHNsKCcgKyBodWUgKyAnLCA5MCUsIDY1JSknO1xuXHRcdH1cblx0fTtcbn0pOyIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdjb250YWN0R3JvdXBGaWx0ZXInLCBmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24gKGNvbnRhY3RzLCBncm91cCkge1xuXHRcdGlmICh0eXBlb2YgY29udGFjdHMgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gY29udGFjdHM7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZ3JvdXAgPT09ICd1bmRlZmluZWQnIHx8IGdyb3VwLnRvTG93ZXJDYXNlKCkgPT09IHQoJ2NvbnRhY3RzJywgJ0FsbCBjb250YWN0cycpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdHJldHVybiBjb250YWN0cztcblx0XHR9XG5cdFx0dmFyIGZpbHRlciA9IFtdO1xuXHRcdGlmIChjb250YWN0cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGNvbnRhY3RzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChncm91cC50b0xvd2VyQ2FzZSgpID09PSB0KCdjb250YWN0cycsICdOb3QgZ3JvdXBlZCcpLnRvTG93ZXJDYXNlKCkpIHtcblx0XHRcdFx0XHRpZiAoY29udGFjdHNbaV0uY2F0ZWdvcmllcygpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0ZmlsdGVyLnB1c2goY29udGFjdHNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoY29udGFjdHNbaV0uY2F0ZWdvcmllcygpLmluZGV4T2YoZ3JvdXApID49IDApIHtcblx0XHRcdFx0XHRcdGZpbHRlci5wdXNoKGNvbnRhY3RzW2ldKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZpbHRlcjtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2ZpZWxkRmlsdGVyJywgZnVuY3Rpb24oKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0cmV0dXJuIGZ1bmN0aW9uIChmaWVsZHMsIGNvbnRhY3QpIHtcblx0XHRpZiAodHlwZW9mIGZpZWxkcyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBmaWVsZHM7XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgY29udGFjdCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBmaWVsZHM7XG5cdFx0fVxuXHRcdHZhciBmaWx0ZXIgPSBbXTtcblx0XHRpZiAoZmllbGRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgZmllbGRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChmaWVsZHNbaV0ubXVsdGlwbGUgKSB7XG5cdFx0XHRcdFx0ZmlsdGVyLnB1c2goZmllbGRzW2ldKTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChjb250YWN0LmdldFByb3BlcnR5KGZpZWxkc1tpXS5pZCkpKSB7XG5cdFx0XHRcdFx0ZmlsdGVyLnB1c2goZmllbGRzW2ldKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignZmlyc3RDaGFyYWN0ZXInLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIGlucHV0LmNoYXJBdCgwKTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2xvY2FsZU9yZGVyQnknLCBbZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24gKGFycmF5LCBzb3J0UHJlZGljYXRlLCByZXZlcnNlT3JkZXIpIHtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkoYXJyYXkpKSByZXR1cm4gYXJyYXk7XG5cdFx0aWYgKCFzb3J0UHJlZGljYXRlKSByZXR1cm4gYXJyYXk7XG5cblx0XHR2YXIgYXJyYXlDb3B5ID0gW107XG5cdFx0YW5ndWxhci5mb3JFYWNoKGFycmF5LCBmdW5jdGlvbiAoaXRlbSkge1xuXHRcdFx0YXJyYXlDb3B5LnB1c2goaXRlbSk7XG5cdFx0fSk7XG5cblx0XHRhcnJheUNvcHkuc29ydChmdW5jdGlvbiAoYSwgYikge1xuXHRcdFx0dmFyIHZhbHVlQSA9IGFbc29ydFByZWRpY2F0ZV07XG5cdFx0XHRpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHZhbHVlQSkpIHtcblx0XHRcdFx0dmFsdWVBID0gYVtzb3J0UHJlZGljYXRlXSgpO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHZhbHVlQiA9IGJbc29ydFByZWRpY2F0ZV07XG5cdFx0XHRpZiAoYW5ndWxhci5pc0Z1bmN0aW9uKHZhbHVlQikpIHtcblx0XHRcdFx0dmFsdWVCID0gYltzb3J0UHJlZGljYXRlXSgpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYW5ndWxhci5pc1N0cmluZyh2YWx1ZUEpKSB7XG5cdFx0XHRcdHJldHVybiAhcmV2ZXJzZU9yZGVyID8gdmFsdWVBLmxvY2FsZUNvbXBhcmUodmFsdWVCKSA6IHZhbHVlQi5sb2NhbGVDb21wYXJlKHZhbHVlQSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhbmd1bGFyLmlzTnVtYmVyKHZhbHVlQSkgfHwgYW5ndWxhci5pc0Jvb2xlYW4odmFsdWVBKSkge1xuXHRcdFx0XHRyZXR1cm4gIXJldmVyc2VPcmRlciA/IHZhbHVlQSAtIHZhbHVlQiA6IHZhbHVlQiAtIHZhbHVlQTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gYXJyYXlDb3B5O1xuXHR9O1xufV0pO1xuXG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignbmV3Q29udGFjdCcsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gaW5wdXQgIT09ICcnID8gaW5wdXQgOiB0KCdjb250YWN0cycsICdOZXcgY29udGFjdCcpO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignb3JkZXJEZXRhaWxJdGVtcycsIGZ1bmN0aW9uKHZDYXJkUHJvcGVydGllc1NlcnZpY2UpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24oaXRlbXMsIGZpZWxkLCByZXZlcnNlKSB7XG5cblx0XHR2YXIgZmlsdGVyZWQgPSBbXTtcblx0XHRhbmd1bGFyLmZvckVhY2goaXRlbXMsIGZ1bmN0aW9uKGl0ZW0pIHtcblx0XHRcdGZpbHRlcmVkLnB1c2goaXRlbSk7XG5cdFx0fSk7XG5cblx0XHR2YXIgZmllbGRPcmRlciA9IGFuZ3VsYXIuY29weSh2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmZpZWxkT3JkZXIpO1xuXHRcdC8vIHJldmVyc2UgdG8gbW92ZSBjdXN0b20gaXRlbXMgdG8gdGhlIGVuZCAoaW5kZXhPZiA9PSAtMSlcblx0XHRmaWVsZE9yZGVyLnJldmVyc2UoKTtcblxuXHRcdGZpbHRlcmVkLnNvcnQoZnVuY3Rpb24gKGEsIGIpIHtcblx0XHRcdGlmKGZpZWxkT3JkZXIuaW5kZXhPZihhW2ZpZWxkXSkgPCBmaWVsZE9yZGVyLmluZGV4T2YoYltmaWVsZF0pKSB7XG5cdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0fVxuXHRcdFx0aWYoZmllbGRPcmRlci5pbmRleE9mKGFbZmllbGRdKSA+IGZpZWxkT3JkZXIuaW5kZXhPZihiW2ZpZWxkXSkpIHtcblx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fSk7XG5cblx0XHRpZihyZXZlcnNlKSBmaWx0ZXJlZC5yZXZlcnNlKCk7XG5cdFx0cmV0dXJuIGZpbHRlcmVkO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcigndG9BcnJheScsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG5cdFx0aWYgKCEob2JqIGluc3RhbmNlb2YgT2JqZWN0KSkgcmV0dXJuIG9iajtcblx0XHRyZXR1cm4gXy5tYXAob2JqLCBmdW5jdGlvbih2YWwsIGtleSkge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh2YWwsICcka2V5Jywge3ZhbHVlOiBrZXl9KTtcblx0XHR9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ3ZDYXJkMkpTT04nLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIHZDYXJkLnBhcnNlKGlucHV0KTtcblx0fTtcbn0pO1xuIl19
