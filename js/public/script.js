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

	ctrl.t = {
		download: t('contacts', 'Download'),
		showURL:t('contacts', 'ShowURL'),
		shareAddressbook: t('contacts', 'Share Addressbook'),
		deleteAddressbook: t('contacts', 'Delete Addressbook'),
		shareInputPlaceHolder: t('contacts', 'Share with users or groups'),
		delete: t('contacts', 'Delete'),
		canEdit: t('contacts', 'can edit')
	};

	ctrl.showUrl = false;
	/* globals oc_config */

	function compareVersion(version1, version2) {
		for (var i = 0; i < Math.max(version1.length, version2.length); i++) {
			var a = version1[i] || 0;
			var b = version2[i] || 0;
			if (Number(a) < Number(b)) {
				return true;
			}
			if (version1[i] !== version2[i]) {
				return false;
			}
		}
		return false;
	}
	/* eslint-disable camelcase */
	ctrl.canExport = compareVersion([9, 0, 2, 0], oc_config.version.split('.'));
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

	ctrl.removePhoto = function() {
		ctrl.contact.removeProperty('photo', ctrl.contact.getProperty('photo'));
		ContactService.update(ctrl.contact);
		$('avatar').removeClass('maximized');
	};

	ctrl.downloadPhoto = function() {
		/* globals ArrayBuffer, Uint8Array */
		var img = document.getElementById('contact-avatar');
		// atob to base64_decode the data-URI
		var imageSplit = img.src.split(',');
		// "data:image/png;base64" -> "png"
		var extension = '.' + imageSplit[0].split(';')[0].split('/')[1];
		var imageData = atob(imageSplit[1]);
		// Use typed arrays to convert the binary data to a Blob
		var arrayBuffer = new ArrayBuffer(imageData.length);
		var view = new Uint8Array(arrayBuffer);
		for (var i=0; i<imageData.length; i++) {
			view[i] = imageData.charCodeAt(i) & 0xff;
		}
		var blob = new Blob([arrayBuffer], {type: 'application/octet-stream'});

		// Use the URL object to create a temporary URL
		var url = (window.webkitURL || window.URL).createObjectURL(blob);

		var a = document.createElement('a');
		document.body.appendChild(a);
		a.style = 'display: none';
		a.href = url;
		a.download = ctrl.contact.uid() + extension;
		a.click();
		window.URL.revokeObjectURL(url);
		a.remove();
	};

	ctrl.openPhoto = function() {
		$('avatar').toggleClass('maximized');
	};

	// Quit avatar preview
	$('avatar').click(function() {
		$('avatar').removeClass('maximized');
	});
	$('avatar img, avatar .avatar-options').click(function(e) {
		e.stopPropagation();
	});
	$(document).keyup(function(e) {
		if (e.keyCode === 27) {
			$('avatar').removeClass('maximized');
		}
	});

}]);

angular.module('contactsApp')
.directive('avatar', ['ContactService', function(ContactService) {
	return {
		scope: {
			contact: '=data'
		},
		controller: 'avatarCtrl',
		controllerAs: 'ctrl',
		bindToController: {
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

	ctrl.t = {
		errorMessage : t('contacts', 'This card is corrupted and has been fixed. Please check the data and trigger a save to make the changes permanent.'),
	};

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
		selectField : t('contacts', 'Add field ...'),
		download : t('contacts', 'Download'),
		delete : t('contacts', 'Delete'),
		save : t('contacts', 'Save changes')
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
				angular.forEach(input.get(0).files, function(file) {
					var reader = new FileReader();

					reader.addEventListener('load', function () {
						scope.$apply(function () {
							ContactService.import.call(ContactService, reader.result, file.type, null, function (progress) {
								if (progress === 1) {
									scope.importText = importText;
								} else {
									scope.importText = parseInt(Math.floor(progress * 100)) + '%';
								}
							});
						});
					}, false);

					if (file) {
						reader.readAsText(file);
					}
				});
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
		honorificSuffix: t('contacts', 'Suffix'),
		delete: t('contacts', 'Delete')
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
			failedProps: [],

			dateProperties: ['bday', 'anniversary', 'deathdate'],

			addressBookId: addressBook.displayName,

			version: function() {
				var property = this.getProperty('version');
				if(property) {
					return property.value;
				}

				return undefined;
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
				var displayName = this.fullName() || this.org() || '';
				if(angular.isArray(displayName)) {
					return displayName.join(' ');
				}
				return displayName;
			},

			readableFilename: function() {
				if(this.displayName()) {
					return (this.displayName()) + '.vcf';
				} else {
					// fallback to default filename (see download attribute)
					return '';
				}

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
						if (angular.isUndefined(type)) {
							return undefined;
						}
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
					var property = this.validate('categories', this.getProperty('categories'));
					if(!property) {
						return [];
					}
					if (angular.isArray(property.value)) {
						return property.value;
					}
					return [property.value];
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

			getISODate: function(date) {
				function pad(number) {
					if (number < 10) {
						return '0' + number;
					}
					return '' + number;
				}

				return date.getUTCFullYear() + '' +
						pad(date.getUTCMonth() + 1) +
						pad(date.getUTCDate()) +
						'T' + pad(date.getUTCHours()) +
						pad(date.getUTCMinutes()) +
						pad(date.getUTCSeconds()) + 'Z';
			},

			syncVCard: function() {

				this.setProperty('rev', { value: this.getISODate(new Date()) });
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

				// Revalidate all props
				_.each(self.failedProps, function(name, index) {
					if (!_.isUndefined(self.props[name]) && !_.isUndefined(self.props[name][0])) {
						// Set dates again to make sure they are in RFC-6350 format
						self.failedProps.splice(index, 1);
						self.validate(name, self.props[name][0]);
					}
				});

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
			},

			validate: function(prop, property) {
				switch(prop) {
				case 'categories':
					// Avoid unescaped commas
					if (angular.isArray(property.value)) {
						if(property.value.join(';').indexOf(',') !== -1) {
							this.failedProps.push(prop);
							property.value = property.value.join(',').split(',');
						}
					} else if (angular.isString(property.value)) {
						if(property.value.indexOf(',') !== -1) {
							this.failedProps.push(prop);
							property.value = property.value.split(',');
						}
					}
					// Remove duplicate categories
					var uniqueCategories = _.unique(property.value);
					if(!angular.equals(uniqueCategories, property.value)) {
						this.failedProps.push(prop);
						property.value = uniqueCategories;
						//console.debug(this.uid()+': Categories duplicate: ' + property.value);
					}
					break;
				}
				return property;
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
			this.categories([]);
		} else {
			if (angular.isString(property.value)) {
				this.categories([property.value]);
			}
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
			$('#details-fullName').select();
			return newContact;
		}).catch(function() {
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
			if (['3.0', '4.0'].indexOf(newContact.version()) < 0) {
				if (progressCallback) {
					progressCallback(num / singleVCards.length);
				}
				OC.Notification.showTemporary(t('contacts', 'Only VCard version 4.0 (RFC6350) or version 3.0 (RFC2426) are supported.'));
				num++;
				continue;
			}
			this.create(newContact, addressBook).then(function() {
				// Update the progress indicator
				if (progressCallback) {
					progressCallback(num / singleVCards.length);
				}
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

			if (angular.isNumber(valueA) || typeof valueA === 'boolean') {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1haW4uanMiLCJkYXRlcGlja2VyX2RpcmVjdGl2ZS5qcyIsImZvY3VzX2RpcmVjdGl2ZS5qcyIsImlucHV0cmVzaXplX2RpcmVjdGl2ZS5qcyIsImFkZHJlc3NCb29rL2FkZHJlc3NCb29rX2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9vay9hZGRyZXNzQm9va19kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2NvbnRyb2xsZXIuanMiLCJhZGRyZXNzQm9va0xpc3QvYWRkcmVzc0Jvb2tMaXN0X2RpcmVjdGl2ZS5qcyIsImF2YXRhci9hdmF0YXJfY29udHJvbGxlci5qcyIsImF2YXRhci9hdmF0YXJfZGlyZWN0aXZlLmpzIiwiY29udGFjdC9jb250YWN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0L2NvbnRhY3RfZGlyZWN0aXZlLmpzIiwiY29udGFjdERldGFpbHMvY29udGFjdERldGFpbHNfY29udHJvbGxlci5qcyIsImNvbnRhY3REZXRhaWxzL2NvbnRhY3REZXRhaWxzX2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RJbXBvcnQvY29udGFjdEltcG9ydF9jb250cm9sbGVyLmpzIiwiY29udGFjdEltcG9ydC9jb250YWN0SW1wb3J0X2RpcmVjdGl2ZS5qcyIsImNvbnRhY3RMaXN0L2NvbnRhY3RMaXN0X2NvbnRyb2xsZXIuanMiLCJjb250YWN0TGlzdC9jb250YWN0TGlzdF9kaXJlY3RpdmUuanMiLCJkZXRhaWxzSXRlbS9kZXRhaWxzSXRlbV9jb250cm9sbGVyLmpzIiwiZGV0YWlsc0l0ZW0vZGV0YWlsc0l0ZW1fZGlyZWN0aXZlLmpzIiwiZ3JvdXAvZ3JvdXBfY29udHJvbGxlci5qcyIsImdyb3VwL2dyb3VwX2RpcmVjdGl2ZS5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfY29udHJvbGxlci5qcyIsImdyb3VwTGlzdC9ncm91cExpc3RfZGlyZWN0aXZlLmpzIiwibmV3Q29udGFjdEJ1dHRvbi9uZXdDb250YWN0QnV0dG9uX2NvbnRyb2xsZXIuanMiLCJuZXdDb250YWN0QnV0dG9uL25ld0NvbnRhY3RCdXR0b25fZGlyZWN0aXZlLmpzIiwicGFyc2Vycy90ZWxNb2RlbF9kaXJlY3RpdmUuanMiLCJhZGRyZXNzQm9va19tb2RlbC5qcyIsImNvbnRhY3RfbW9kZWwuanMiLCJhZGRyZXNzQm9va19zZXJ2aWNlLmpzIiwiY29udGFjdF9zZXJ2aWNlLmpzIiwiZGF2Q2xpZW50X3NlcnZpY2UuanMiLCJkYXZfc2VydmljZS5qcyIsInNlYXJjaF9zZXJ2aWNlLmpzIiwic2V0dGluZ3Nfc2VydmljZS5qcyIsInZDYXJkUHJvcGVydGllcy5qcyIsIkpTT04ydkNhcmRfZmlsdGVyLmpzIiwiY29udGFjdENvbG9yX2ZpbHRlci5qcyIsImNvbnRhY3RHcm91cF9maWx0ZXIuanMiLCJmaWVsZF9maWx0ZXIuanMiLCJmaXJzdENoYXJhY3Rlcl9maWx0ZXIuanMiLCJsb2NhbGVPcmRlckJ5X2ZpbHRlci5qcyIsIm5ld0NvbnRhY3RfZmlsdGVyLmpzIiwib3JkZXJEZXRhaWxJdGVtc19maWx0ZXIuanMiLCJ0b0FycmF5X2ZpbHRlci5qcyIsInZDYXJkMkpTT05fZmlsdGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7Ozs7O0FBVUEsUUFBUSxPQUFPLGVBQWUsQ0FBQyxTQUFTLGlCQUFpQixXQUFXLGdCQUFnQixhQUFhO0NBQ2hHLDBCQUFPLFNBQVMsZ0JBQWdCOztDQUVoQyxlQUFlLEtBQUssU0FBUztFQUM1QixVQUFVOzs7Q0FHWCxlQUFlLEtBQUssY0FBYztFQUNqQyxVQUFVOzs7Q0FHWCxlQUFlLFVBQVUsTUFBTSxFQUFFLFlBQVk7OztBQUc5QztBQ3hCQSxRQUFRLE9BQU87Q0FDZCxVQUFVLGNBQWMsV0FBVztDQUNuQyxPQUFPO0VBQ04sVUFBVTtFQUNWLFVBQVU7RUFDVixPQUFPLFVBQVUsT0FBTyxTQUFTLE9BQU8sYUFBYTtHQUNwRCxFQUFFLFdBQVc7SUFDWixRQUFRLFdBQVc7S0FDbEIsV0FBVztLQUNYLFNB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QUUsWUFBWTs7O0FBRzlDO0FDTkEsUUFBUSxPQUFPO0NBQ2QsT0FBTywrQ0FBb0IsU0FBUyx3QkFBd0I7Q0FDNUQ7Q0FDQSxPQUFPLFNBQVMsT0FBTyxPQUFPLFNBQVM7O0VBRXRDLElBQUksV0FBVztFQUNmLFFBQVEsUUFBUSxPQUFPLFNBQVMsTUFBTTtHQUNyQyxTQUFTLEtBQUs7OztFQUdmLElBQUksYUFBYSxRQUFRLEtBQUssdUJBQXVCOztFQUVyRCxXQUFXOztFQUVYLFNBQVMsS0FBSyxVQUFVLEdBQUcsR0FBRztHQUM3QixHQUFHLFdBQVcsUUFBUSxFQUFFLFVBQVUsV0FBVyxRQUFRLEVBQUUsU0FBUztJQUMvRCxPQUFPOztHQUVSLEdBQUcsV0FBVyxRQUFRLEVBQUUsVUFBVSxXQUFXLFFBQVEsRUFBRSxTQUFTO0lBQy9ELE9BQU8sQ0FBQzs7R0FFVCxPQUFPOzs7RUFHUixHQUFHLFNBQVMsU0FBUztFQUNyQixPQUFPOzs7QUFHVDtBQzVCQSxRQUFRLE9BQU87Q0FDZCxPQUFPLFdBQVcsV0FBVztDQUM3QixPQUFPLFNBQVMsS0FBSztFQUNwQixJQUFJLEVBQUUsZUFBZSxTQUFTLE9BQU87RUFDckMsT0FBTyxFQUFFLElBQUksS0FBSyxTQUFTLEtBQUssS0FBSztHQUNwQyxPQUFPLE9BQU8sZUFBZSxLQUFLLFFBQVEsQ0FBQyxPQUFPOzs7O0FBSXJEO0FDVEEsUUFBUSxPQUFPO0NBQ2QsT0FBTyxjQUFjLFdBQVc7Q0FDaEMsT0FBTyxTQUFTLE9BQU87RUFDdEIsT0FBTyxNQUFNLE1BQU07OztBQUdyQiIsImZpbGUiOiJzY3JpcHQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE5leHRjbG91ZCAtIGNvbnRhY3RzXG4gKlxuICogVGhpcyBmaWxlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBBZmZlcm8gR2VuZXJhbCBQdWJsaWMgTGljZW5zZSB2ZXJzaW9uIDMgb3JcbiAqIGxhdGVyLiBTZWUgdGhlIENPUFlJTkcgZmlsZS5cbiAqXG4gKiBAYXV0aG9yIEhlbmRyaWsgTGVwcGVsc2FjayA8aGVuZHJpa0BsZXBwZWxzYWNrLmRlPlxuICogQGNvcHlyaWdodCBIZW5kcmlrIExlcHBlbHNhY2sgMjAxNVxuICovXG5cbmFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcsIFsndXVpZDQnLCAnYW5ndWxhci1jYWNoZScsICduZ1JvdXRlJywgJ3VpLmJvb3RzdHJhcCcsICd1aS5zZWxlY3QnLCAnbmdTYW5pdGl6ZSddKVxuLmNvbmZpZyhmdW5jdGlvbigkcm91dGVQcm92aWRlcikge1xuXG5cdCRyb3V0ZVByb3ZpZGVyLndoZW4oJy86Z2lkJywge1xuXHRcdHRlbXBsYXRlOiAnPGNvbnRhY3RkZXRhaWxzPjwvY29udGFjdGRldGFpbHM+J1xuXHR9KTtcblxuXHQkcm91dGVQcm92aWRlci53aGVuKCcvOmdpZC86dWlkJywge1xuXHRcdHRlbXBsYXRlOiAnPGNvbnRhY3RkZXRhaWxzPjwvY29udGFjdGRldGFpbHM+J1xuXHR9KTtcblxuXHQkcm91dGVQcm92aWRlci5vdGhlcndpc2UoJy8nICsgdCgnY29udGFjdHMnLCAnQWxsIGNvbnRhY3RzJykpO1xuXG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdkYXRlcGlja2VyJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRyZXF1aXJlIDogJ25nTW9kZWwnLFxuXHRcdGxpbmsgOiBmdW5jdGlvbiAoc2NvcGUsIGVsZW1lbnQsIGF0dHJzLCBuZ01vZGVsQ3RybCkge1xuXHRcdFx0JChmdW5jdGlvbigpIHtcblx0XHRcdFx0ZWxlbWVudC5kYXRlcGlja2VyKHtcblx0XHRcdFx0XHRkYXRlRm9ybWF0Oid5eS1tbS1kZCcsXG5cdFx0XHRcdFx0bWluRGF0ZTogbnVsbCxcblx0XHRcdFx0XHRtYXhEYXRlOiBudWxsLFxuXHRcdFx0XHRcdG9uU2VsZWN0OmZ1bmN0aW9uIChkYXRlKSB7XG5cdFx0XHRcdFx0XHRuZ01vZGVsQ3RybC4kc2V0Vmlld1ZhbHVlKGRhdGUpO1xuXHRcdFx0XHRcdFx0c2NvcGUuJGFwcGx5KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2ZvY3VzRXhwcmVzc2lvbicsIGZ1bmN0aW9uICgkdGltZW91dCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0bGluazoge1xuXHRcdFx0cG9zdDogZnVuY3Rpb24gcG9zdExpbmsoc2NvcGUsIGVsZW1lbnQsIGF0dHJzKSB7XG5cdFx0XHRcdHNjb3BlLiR3YXRjaChhdHRycy5mb2N1c0V4cHJlc3Npb24sIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRpZiAoYXR0cnMuZm9jdXNFeHByZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRpZiAoc2NvcGUuJGV2YWwoYXR0cnMuZm9jdXNFeHByZXNzaW9uKSkge1xuXHRcdFx0XHRcdFx0XHQkdGltZW91dChmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGVsZW1lbnQuaXMoJ2lucHV0JykpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGVsZW1lbnQuZm9jdXMoKTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0ZWxlbWVudC5maW5kKCdpbnB1dCcpLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9LCAxMDApOyAvL25lZWQgc29tZSBkZWxheSB0byB3b3JrIHdpdGggbmctZGlzYWJsZWRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2lucHV0cmVzaXplJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJyxcblx0XHRsaW5rIDogZnVuY3Rpb24gKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgZWxJbnB1dCA9IGVsZW1lbnQudmFsKCk7XG5cdFx0XHRlbGVtZW50LmJpbmQoJ2tleWRvd24ga2V5dXAgbG9hZCBmb2N1cycsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRlbElucHV0ID0gZWxlbWVudC52YWwoKTtcblx0XHRcdFx0Ly8gSWYgc2V0IHRvIDAsIHRoZSBtaW4td2lkdGggY3NzIGRhdGEgaXMgaWdub3JlZFxuXHRcdFx0XHR2YXIgbGVuZ3RoID0gZWxJbnB1dC5sZW5ndGggPiAxID8gZWxJbnB1dC5sZW5ndGggOiAxO1xuXHRcdFx0XHRlbGVtZW50LmF0dHIoJ3NpemUnLCBsZW5ndGgpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2FkZHJlc3Nib29rQ3RybCcsIGZ1bmN0aW9uKCRzY29wZSwgQWRkcmVzc0Jvb2tTZXJ2aWNlKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnQgPSB7XG5cdFx0ZG93bmxvYWQ6IHQoJ2NvbnRhY3RzJywgJ0Rvd25sb2FkJyksXG5cdFx0c2hvd1VSTDp0KCdjb250YWN0cycsICdTaG93VVJMJyksXG5cdFx0c2hhcmVBZGRyZXNzYm9vazogdCgnY29udGFjdHMnLCAnU2hhcmUgQWRkcmVzc2Jvb2snKSxcblx0XHRkZWxldGVBZGRyZXNzYm9vazogdCgnY29udGFjdHMnLCAnRGVsZXRlIEFkZHJlc3Nib29rJyksXG5cdFx0c2hhcmVJbnB1dFBsYWNlSG9sZGVyOiB0KCdjb250YWN0cycsICdTaGFyZSB3aXRoIHVzZXJzIG9yIGdyb3VwcycpLFxuXHRcdGRlbGV0ZTogdCgnY29udGFjdHMnLCAnRGVsZXRlJyksXG5cdFx0Y2FuRWRpdDogdCgnY29udGFjdHMnLCAnY2FuIGVkaXQnKVxuXHR9O1xuXG5cdGN0cmwuc2hvd1VybCA9IGZhbHNlO1xuXHQvKiBnbG9iYWxzIG9jX2NvbmZpZyAqL1xuXG5cdGZ1bmN0aW9uIGNvbXBhcmVWZXJzaW9uKHZlcnNpb24xLCB2ZXJzaW9uMikge1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgTWF0aC5tYXgodmVyc2lvbjEubGVuZ3RoLCB2ZXJzaW9uMi5sZW5ndGgpOyBpKyspIHtcblx0XHRcdHZhciBhID0gdmVyc2lvbjFbaV0gfHwgMDtcblx0XHRcdHZhciBiID0gdmVyc2lvbjJbaV0gfHwgMDtcblx0XHRcdGlmIChOdW1iZXIoYSkgPCBOdW1iZXIoYikpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodmVyc2lvbjFbaV0gIT09IHZlcnNpb24yW2ldKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdC8qIGVzbGludC1kaXNhYmxlIGNhbWVsY2FzZSAqL1xuXHRjdHJsLmNhbkV4cG9ydCA9IGNvbXBhcmVWZXJzaW9uKFs5LCAwLCAyLCAwXSwgb2NfY29uZmlnLnZlcnNpb24uc3BsaXQoJy4nKSk7XG5cdC8qIGVzbGludC1lbmFibGUgY2FtZWxjYXNlICovXG5cblx0Y3RybC50b2dnbGVTaG93VXJsID0gZnVuY3Rpb24oKSB7XG5cdFx0Y3RybC5zaG93VXJsID0gIWN0cmwuc2hvd1VybDtcblx0fTtcblxuXHRjdHJsLnRvZ2dsZVNoYXJlc0VkaXRvciA9IGZ1bmN0aW9uKCkge1xuXHRcdGN0cmwuZWRpdGluZ1NoYXJlcyA9ICFjdHJsLmVkaXRpbmdTaGFyZXM7XG5cdFx0Y3RybC5zZWxlY3RlZFNoYXJlZSA9IG51bGw7XG5cdH07XG5cblx0LyogRnJvbSBDYWxlbmRhci1SZXdvcmsgLSBqcy9hcHAvY29udHJvbGxlcnMvY2FsZW5kYXJsaXN0Y29udHJvbGxlci5qcyAqL1xuXHRjdHJsLmZpbmRTaGFyZWUgPSBmdW5jdGlvbiAodmFsKSB7XG5cdFx0cmV0dXJuICQuZ2V0KFxuXHRcdFx0T0MubGlua1RvT0NTKCdhcHBzL2ZpbGVzX3NoYXJpbmcvYXBpL3YxJykgKyAnc2hhcmVlcycsXG5cdFx0XHR7XG5cdFx0XHRcdGZvcm1hdDogJ2pzb24nLFxuXHRcdFx0XHRzZWFyY2g6IHZhbC50cmltKCksXG5cdFx0XHRcdHBlclBhZ2U6IDIwMCxcblx0XHRcdFx0aXRlbVR5cGU6ICdwcmluY2lwYWxzJ1xuXHRcdFx0fVxuXHRcdCkudGhlbihmdW5jdGlvbihyZXN1bHQpIHtcblx0XHRcdC8vIFRvZG8gLSBmaWx0ZXIgb3V0IGN1cnJlbnQgdXNlciwgZXhpc3Rpbmcgc2hhcmVlc1xuXHRcdFx0dmFyIHVzZXJzICAgPSByZXN1bHQub2NzLmRhdGEuZXhhY3QudXNlcnMuY29uY2F0KHJlc3VsdC5vY3MuZGF0YS51c2Vycyk7XG5cdFx0XHR2YXIgZ3JvdXBzICA9IHJlc3VsdC5vY3MuZGF0YS5leGFjdC5ncm91cHMuY29uY2F0KHJlc3VsdC5vY3MuZGF0YS5ncm91cHMpO1xuXG5cdFx0XHR2YXIgdXNlclNoYXJlcyA9IGN0cmwuYWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycztcblx0XHRcdHZhciB1c2VyU2hhcmVzTGVuZ3RoID0gdXNlclNoYXJlcy5sZW5ndGg7XG5cdFx0XHR2YXIgaSwgajtcblxuXHRcdFx0Ly8gRmlsdGVyIG91dCBjdXJyZW50IHVzZXJcblx0XHRcdHZhciB1c2Vyc0xlbmd0aCA9IHVzZXJzLmxlbmd0aDtcblx0XHRcdGZvciAoaSA9IDAgOyBpIDwgdXNlcnNMZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpZiAodXNlcnNbaV0udmFsdWUuc2hhcmVXaXRoID09PSBPQy5jdXJyZW50VXNlcikge1xuXHRcdFx0XHRcdHVzZXJzLnNwbGljZShpLCAxKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBOb3cgZmlsdGVyIG91dCBhbGwgc2hhcmVlcyB0aGF0IGFyZSBhbHJlYWR5IHNoYXJlZCB3aXRoXG5cdFx0XHRmb3IgKGkgPSAwOyBpIDwgdXNlclNoYXJlc0xlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHZhciBzaGFyZSA9IHVzZXJTaGFyZXNbaV07XG5cdFx0XHRcdHVzZXJzTGVuZ3RoID0gdXNlcnMubGVuZ3RoO1xuXHRcdFx0XHRmb3IgKGogPSAwOyBqIDwgdXNlcnNMZW5ndGg7IGorKykge1xuXHRcdFx0XHRcdGlmICh1c2Vyc1tqXS52YWx1ZS5zaGFyZVdpdGggPT09IHNoYXJlLmlkKSB7XG5cdFx0XHRcdFx0XHR1c2Vycy5zcGxpY2UoaiwgMSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29tYmluZSB1c2VycyBhbmQgZ3JvdXBzXG5cdFx0XHR1c2VycyA9IHVzZXJzLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGlzcGxheTogaXRlbS52YWx1ZS5zaGFyZVdpdGgsXG5cdFx0XHRcdFx0dHlwZTogT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSLFxuXHRcdFx0XHRcdGlkZW50aWZpZXI6IGl0ZW0udmFsdWUuc2hhcmVXaXRoXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdFx0Z3JvdXBzID0gZ3JvdXBzLm1hcChmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0ZGlzcGxheTogaXRlbS52YWx1ZS5zaGFyZVdpdGggKyAnIChncm91cCknLFxuXHRcdFx0XHRcdHR5cGU6IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVAsXG5cdFx0XHRcdFx0aWRlbnRpZmllcjogaXRlbS52YWx1ZS5zaGFyZVdpdGhcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gZ3JvdXBzLmNvbmNhdCh1c2Vycyk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC5vblNlbGVjdFNoYXJlZSA9IGZ1bmN0aW9uIChpdGVtKSB7XG5cdFx0Y3RybC5zZWxlY3RlZFNoYXJlZSA9IG51bGw7XG5cdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIGl0ZW0udHlwZSwgaXRlbS5pZGVudGlmaWVyLCBmYWxzZSwgZmFsc2UpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cblx0fTtcblxuXHRjdHJsLnVwZGF0ZUV4aXN0aW5nVXNlclNoYXJlID0gZnVuY3Rpb24odXNlcklkLCB3cml0YWJsZSkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIsIHVzZXJJZCwgd3JpdGFibGUsIHRydWUpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cblx0Y3RybC51cGRhdGVFeGlzdGluZ0dyb3VwU2hhcmUgPSBmdW5jdGlvbihncm91cElkLCB3cml0YWJsZSkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLCBncm91cElkLCB3cml0YWJsZSwgdHJ1ZSkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVuc2hhcmVGcm9tVXNlciA9IGZ1bmN0aW9uKHVzZXJJZCkge1xuXHRcdEFkZHJlc3NCb29rU2VydmljZS51bnNoYXJlKGN0cmwuYWRkcmVzc0Jvb2ssIE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUiwgdXNlcklkKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwudW5zaGFyZUZyb21Hcm91cCA9IGZ1bmN0aW9uKGdyb3VwSWQpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UudW5zaGFyZShjdHJsLmFkZHJlc3NCb29rLCBPQy5TaGFyZS5TSEFSRV9UWVBFX0dST1VQLCBncm91cElkKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlQWRkcmVzc0Jvb2sgPSBmdW5jdGlvbigpIHtcblx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZGVsZXRlKGN0cmwuYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0fSk7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2FkZHJlc3Nib29rJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2FkZHJlc3Nib29rQ3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0YWRkcmVzc0Jvb2s6ICc9ZGF0YScsXG5cdFx0XHRsaXN0OiAnPSdcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9hZGRyZXNzQm9vay5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdhZGRyZXNzYm9va2xpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCBBZGRyZXNzQm9va1NlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cblx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0Y3RybC5hZGRyZXNzQm9va3MgPSBhZGRyZXNzQm9va3M7XG5cdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdH0pO1xuXG5cdGN0cmwudCA9IHtcblx0XHRhZGRyZXNzQm9va05hbWUgOiB0KCdjb250YWN0cycsICdBZGRyZXNzIGJvb2sgbmFtZScpXG5cdH07XG5cblx0Y3RybC5jcmVhdGVBZGRyZXNzQm9vayA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKSB7XG5cdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuY3JlYXRlKGN0cmwubmV3QWRkcmVzc0Jvb2tOYW1lKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRBZGRyZXNzQm9va1NlcnZpY2UuZ2V0QWRkcmVzc0Jvb2soY3RybC5uZXdBZGRyZXNzQm9va05hbWUpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRjdHJsLmFkZHJlc3NCb29rcy5wdXNoKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0XHQkc2NvcGUuJGFwcGx5KCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYWRkcmVzc2Jvb2tsaXN0JywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiB7XG5cdFx0cmVzdHJpY3Q6ICdFQScsIC8vIGhhcyB0byBiZSBhbiBhdHRyaWJ1dGUgdG8gd29yayB3aXRoIGNvcmUgY3NzXG5cdFx0c2NvcGU6IHt9LFxuXHRcdGNvbnRyb2xsZXI6ICdhZGRyZXNzYm9va2xpc3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvYWRkcmVzc0Jvb2tMaXN0Lmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2F2YXRhckN0cmwnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5pbXBvcnQgPSBDb250YWN0U2VydmljZS5pbXBvcnQuYmluZChDb250YWN0U2VydmljZSk7XG5cblx0Y3RybC5yZW1vdmVQaG90byA9IGZ1bmN0aW9uKCkge1xuXHRcdGN0cmwuY29udGFjdC5yZW1vdmVQcm9wZXJ0eSgncGhvdG8nLCBjdHJsLmNvbnRhY3QuZ2V0UHJvcGVydHkoJ3Bob3RvJykpO1xuXHRcdENvbnRhY3RTZXJ2aWNlLnVwZGF0ZShjdHJsLmNvbnRhY3QpO1xuXHRcdCQoJ2F2YXRhcicpLnJlbW92ZUNsYXNzKCdtYXhpbWl6ZWQnKTtcblx0fTtcblxuXHRjdHJsLmRvd25sb2FkUGhvdG8gPSBmdW5jdGlvbigpIHtcblx0XHQvKiBnbG9iYWxzIEFycmF5QnVmZmVyLCBVaW50OEFycmF5ICovXG5cdFx0dmFyIGltZyA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250YWN0LWF2YXRhcicpO1xuXHRcdC8vIGF0b2IgdG8gYmFzZTY0X2RlY29kZSB0aGUgZGF0YS1VUklcblx0XHR2YXIgaW1hZ2VTcGxpdCA9IGltZy5zcmMuc3BsaXQoJywnKTtcblx0XHQvLyBcImRhdGE6aW1hZ2UvcG5nO2Jhc2U2NFwiIC0+IFwicG5nXCJcblx0XHR2YXIgZXh0ZW5zaW9uID0gJy4nICsgaW1hZ2VTcGxpdFswXS5zcGxpdCgnOycpWzBdLnNwbGl0KCcvJylbMV07XG5cdFx0dmFyIGltYWdlRGF0YSA9IGF0b2IoaW1hZ2VTcGxpdFsxXSk7XG5cdFx0Ly8gVXNlIHR5cGVkIGFycmF5cyB0byBjb252ZXJ0IHRoZSBiaW5hcnkgZGF0YSB0byBhIEJsb2Jcblx0XHR2YXIgYXJyYXlCdWZmZXIgPSBuZXcgQXJyYXlCdWZmZXIoaW1hZ2VEYXRhLmxlbmd0aCk7XG5cdFx0dmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShhcnJheUJ1ZmZlcik7XG5cdFx0Zm9yICh2YXIgaT0wOyBpPGltYWdlRGF0YS5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmlld1tpXSA9IGltYWdlRGF0YS5jaGFyQ29kZUF0KGkpICYgMHhmZjtcblx0XHR9XG5cdFx0dmFyIGJsb2IgPSBuZXcgQmxvYihbYXJyYXlCdWZmZXJdLCB7dHlwZTogJ2FwcGxpY2F0aW9uL29jdGV0LXN0cmVhbSd9KTtcblxuXHRcdC8vIFVzZSB0aGUgVVJMIG9iamVjdCB0byBjcmVhdGUgYSB0ZW1wb3JhcnkgVVJMXG5cdFx0dmFyIHVybCA9ICh3aW5kb3cud2Via2l0VVJMIHx8IHdpbmRvdy5VUkwpLmNyZWF0ZU9iamVjdFVSTChibG9iKTtcblxuXHRcdHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuXHRcdGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYSk7XG5cdFx0YS5zdHlsZSA9ICdkaXNwbGF5OiBub25lJztcblx0XHRhLmhyZWYgPSB1cmw7XG5cdFx0YS5kb3dubG9hZCA9IGN0cmwuY29udGFjdC51aWQoKSArIGV4dGVuc2lvbjtcblx0XHRhLmNsaWNrKCk7XG5cdFx0d2luZG93LlVSTC5yZXZva2VPYmplY3RVUkwodXJsKTtcblx0XHRhLnJlbW92ZSgpO1xuXHR9O1xuXG5cdGN0cmwub3BlblBob3RvID0gZnVuY3Rpb24oKSB7XG5cdFx0JCgnYXZhdGFyJykudG9nZ2xlQ2xhc3MoJ21heGltaXplZCcpO1xuXHR9O1xuXG5cdC8vIFF1aXQgYXZhdGFyIHByZXZpZXdcblx0JCgnYXZhdGFyJykuY2xpY2soZnVuY3Rpb24oKSB7XG5cdFx0JCgnYXZhdGFyJykucmVtb3ZlQ2xhc3MoJ21heGltaXplZCcpO1xuXHR9KTtcblx0JCgnYXZhdGFyIGltZywgYXZhdGFyIC5hdmF0YXItb3B0aW9ucycpLmNsaWNrKGZ1bmN0aW9uKGUpIHtcblx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHR9KTtcblx0JChkb2N1bWVudCkua2V5dXAoZnVuY3Rpb24oZSkge1xuXHRcdGlmIChlLmtleUNvZGUgPT09IDI3KSB7XG5cdFx0XHQkKCdhdmF0YXInKS5yZW1vdmVDbGFzcygnbWF4aW1pemVkJyk7XG5cdFx0fVxuXHR9KTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnYXZhdGFyJywgZnVuY3Rpb24oQ29udGFjdFNlcnZpY2UpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge1xuXHRcdFx0Y29udGFjdDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0Y29udHJvbGxlcjogJ2F2YXRhckN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHtcblx0XHRcdGNvbnRhY3Q6ICc9ZGF0YSdcblx0XHR9LFxuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgaW1wb3J0VGV4dCA9IHQoJ2NvbnRhY3RzJywgJ0ltcG9ydCcpO1xuXHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cblx0XHRcdHZhciBpbnB1dCA9IGVsZW1lbnQuZmluZCgnaW5wdXQnKTtcblx0XHRcdGlucHV0LmJpbmQoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZmlsZSA9IGlucHV0LmdldCgwKS5maWxlc1swXTtcblx0XHRcdFx0aWYgKGZpbGUuc2l6ZSA+IDEwMjQqMTAyNCkgeyAvLyAxIE1CXG5cdFx0XHRcdFx0T0MuTm90aWZpY2F0aW9uLnNob3dUZW1wb3JhcnkodCgnY29udGFjdHMnLCAnVGhlIHNlbGVjdGVkIGltYWdlIGlzIHRvbyBiaWcgKG1heCAxTUIpJykpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhciByZWFkZXIgPSBuZXcgRmlsZVJlYWRlcigpO1xuXG5cdFx0XHRcdFx0cmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRzY29wZS4kYXBwbHkoZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0XHRcdHNjb3BlLmNvbnRhY3QucGhvdG8ocmVhZGVyLnJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdENvbnRhY3RTZXJ2aWNlLnVwZGF0ZShzY29wZS5jb250YWN0KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0sIGZhbHNlKTtcblxuXHRcdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0XHRyZWFkZXIucmVhZEFzRGF0YVVSTChmaWxlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2F2YXRhci5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdjb250YWN0Q3RybCcsIGZ1bmN0aW9uKCRyb3V0ZSwgJHJvdXRlUGFyYW1zKSB7XG5cdHZhciBjdHJsID0gdGhpcztcblxuXHRjdHJsLnQgPSB7XG5cdFx0ZXJyb3JNZXNzYWdlIDogdCgnY29udGFjdHMnLCAnVGhpcyBjYXJkIGlzIGNvcnJ1cHRlZCBhbmQgaGFzIGJlZW4gZml4ZWQuIFBsZWFzZSBjaGVjayB0aGUgZGF0YSBhbmQgdHJpZ2dlciBhIHNhdmUgdG8gbWFrZSB0aGUgY2hhbmdlcyBwZXJtYW5lbnQuJyksXG5cdH07XG5cblx0Y3RybC5vcGVuQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0dWlkOiBjdHJsLmNvbnRhY3QudWlkKCl9KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2NvbnRhY3RDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7XG5cdFx0XHRjb250YWN0OiAnPWRhdGEnXG5cdFx0fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdjb250YWN0ZGV0YWlsc0N0cmwnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSwgQWRkcmVzc0Jvb2tTZXJ2aWNlLCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCAkcm91dGUsICRyb3V0ZVBhcmFtcywgJHNjb3BlKSB7XG5cblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwubG9hZGluZyA9IHRydWU7XG5cdGN0cmwuc2hvdyA9IGZhbHNlO1xuXG5cdGN0cmwuY2xlYXJDb250YWN0ID0gZnVuY3Rpb24oKSB7XG5cdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHR1aWQ6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdGN0cmwuY29udGFjdCA9IHVuZGVmaW5lZDtcblx0fTtcblxuXHRjdHJsLnVpZCA9ICRyb3V0ZVBhcmFtcy51aWQ7XG5cdGN0cmwudCA9IHtcblx0XHRub0NvbnRhY3RzIDogdCgnY29udGFjdHMnLCAnTm8gY29udGFjdHMgaW4gaGVyZScpLFxuXHRcdHBsYWNlaG9sZGVyTmFtZSA6IHQoJ2NvbnRhY3RzJywgJ05hbWUnKSxcblx0XHRwbGFjZWhvbGRlck9yZyA6IHQoJ2NvbnRhY3RzJywgJ09yZ2FuaXphdGlvbicpLFxuXHRcdHBsYWNlaG9sZGVyVGl0bGUgOiB0KCdjb250YWN0cycsICdUaXRsZScpLFxuXHRcdHNlbGVjdEZpZWxkIDogdCgnY29udGFjdHMnLCAnQWRkIGZpZWxkIC4uLicpLFxuXHRcdGRvd25sb2FkIDogdCgnY29udGFjdHMnLCAnRG93bmxvYWQnKSxcblx0XHRkZWxldGUgOiB0KCdjb250YWN0cycsICdEZWxldGUnKSxcblx0XHRzYXZlIDogdCgnY29udGFjdHMnLCAnU2F2ZSBjaGFuZ2VzJylcblx0fTtcblxuXHRjdHJsLmZpZWxkRGVmaW5pdGlvbnMgPSB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLmZpZWxkRGVmaW5pdGlvbnM7XG5cdGN0cmwuZm9jdXMgPSB1bmRlZmluZWQ7XG5cdGN0cmwuZmllbGQgPSB1bmRlZmluZWQ7XG5cdGN0cmwuYWRkcmVzc0Jvb2tzID0gW107XG5cblx0QWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2tzKSB7XG5cdFx0Y3RybC5hZGRyZXNzQm9va3MgPSBhZGRyZXNzQm9va3M7XG5cblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoY3RybC5jb250YWN0KSkge1xuXHRcdFx0Y3RybC5hZGRyZXNzQm9vayA9IF8uZmluZChjdHJsLmFkZHJlc3NCb29rcywgZnVuY3Rpb24oYm9vaykge1xuXHRcdFx0XHRyZXR1cm4gYm9vay5kaXNwbGF5TmFtZSA9PT0gY3RybC5jb250YWN0LmFkZHJlc3NCb29rSWQ7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y3RybC5sb2FkaW5nID0gZmFsc2U7XG5cdH0pO1xuXG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwudWlkJywgZnVuY3Rpb24obmV3VmFsdWUpIHtcblx0XHRjdHJsLmNoYW5nZUNvbnRhY3QobmV3VmFsdWUpO1xuXHR9KTtcblxuXHRjdHJsLmNoYW5nZUNvbnRhY3QgPSBmdW5jdGlvbih1aWQpIHtcblx0XHRpZiAodHlwZW9mIHVpZCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdFx0JCgnI2FwcC1uYXZpZ2F0aW9uLXRvZ2dsZScpLnJlbW92ZUNsYXNzKCdzaG93ZGV0YWlscycpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRDb250YWN0U2VydmljZS5nZXRCeUlkKHVpZCkudGhlbihmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0XHRpZiAoYW5ndWxhci5pc1VuZGVmaW5lZChjb250YWN0KSkge1xuXHRcdFx0XHRjdHJsLmNsZWFyQ29udGFjdCgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmNvbnRhY3QgPSBjb250YWN0O1xuXHRcdFx0Y3RybC5zaG93ID0gdHJ1ZTtcblx0XHRcdCQoJyNhcHAtbmF2aWdhdGlvbi10b2dnbGUnKS5hZGRDbGFzcygnc2hvd2RldGFpbHMnKTtcblxuXHRcdFx0Y3RybC5hZGRyZXNzQm9vayA9IF8uZmluZChjdHJsLmFkZHJlc3NCb29rcywgZnVuY3Rpb24oYm9vaykge1xuXHRcdFx0XHRyZXR1cm4gYm9vay5kaXNwbGF5TmFtZSA9PT0gY3RybC5jb250YWN0LmFkZHJlc3NCb29rSWQ7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLnVwZGF0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS51cGRhdGUoY3RybC5jb250YWN0KTtcblx0fTtcblxuXHRjdHJsLmRlbGV0ZUNvbnRhY3QgPSBmdW5jdGlvbigpIHtcblx0XHRDb250YWN0U2VydmljZS5kZWxldGUoY3RybC5jb250YWN0KTtcblx0fTtcblxuXHRjdHJsLmFkZEZpZWxkID0gZnVuY3Rpb24oZmllbGQpIHtcblx0XHR2YXIgZGVmYXVsdFZhbHVlID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGZpZWxkKS5kZWZhdWx0VmFsdWUgfHwge3ZhbHVlOiAnJ307XG5cdFx0Y3RybC5jb250YWN0LmFkZFByb3BlcnR5KGZpZWxkLCBkZWZhdWx0VmFsdWUpO1xuXHRcdGN0cmwuZm9jdXMgPSBmaWVsZDtcblx0XHRjdHJsLmZpZWxkID0gJyc7XG5cdH07XG5cblx0Y3RybC5kZWxldGVGaWVsZCA9IGZ1bmN0aW9uIChmaWVsZCwgcHJvcCkge1xuXHRcdGN0cmwuY29udGFjdC5yZW1vdmVQcm9wZXJ0eShmaWVsZCwgcHJvcCk7XG5cdFx0Y3RybC5mb2N1cyA9IHVuZGVmaW5lZDtcblx0fTtcblxuXHRjdHJsLmNoYW5nZUFkZHJlc3NCb29rID0gZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0Q29udGFjdFNlcnZpY2UubW92ZUNvbnRhY3QoY3RybC5jb250YWN0LCBhZGRyZXNzQm9vayk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdjb250YWN0ZGV0YWlscycsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHByaW9yaXR5OiAxLFxuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnY29udGFjdGRldGFpbHNDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7fSxcblx0XHR0ZW1wbGF0ZVVybDogT0MubGlua1RvKCdjb250YWN0cycsICd0ZW1wbGF0ZXMvY29udGFjdERldGFpbHMuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGltcG9ydEN0cmwnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5pbXBvcnQgPSBDb250YWN0U2VydmljZS5pbXBvcnQuYmluZChDb250YWN0U2VydmljZSk7XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5kaXJlY3RpdmUoJ2NvbnRhY3RpbXBvcnQnLCBmdW5jdGlvbihDb250YWN0U2VydmljZSkge1xuXHRyZXR1cm4ge1xuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50KSB7XG5cdFx0XHR2YXIgaW1wb3J0VGV4dCA9IHQoJ2NvbnRhY3RzJywgJ0ltcG9ydCcpO1xuXHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cblx0XHRcdHZhciBpbnB1dCA9IGVsZW1lbnQuZmluZCgnaW5wdXQnKTtcblx0XHRcdGlucHV0LmJpbmQoJ2NoYW5nZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRhbmd1bGFyLmZvckVhY2goaW5wdXQuZ2V0KDApLmZpbGVzLCBmdW5jdGlvbihmaWxlKSB7XG5cdFx0XHRcdFx0dmFyIHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG5cblx0XHRcdFx0XHRyZWFkZXIuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRcdHNjb3BlLiRhcHBseShmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdFx0XHRcdENvbnRhY3RTZXJ2aWNlLmltcG9ydC5jYWxsKENvbnRhY3RTZXJ2aWNlLCByZWFkZXIucmVzdWx0LCBmaWxlLnR5cGUsIG51bGwsIGZ1bmN0aW9uIChwcm9ncmVzcykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChwcm9ncmVzcyA9PT0gMSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0c2NvcGUuaW1wb3J0VGV4dCA9IGltcG9ydFRleHQ7XG5cdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdHNjb3BlLmltcG9ydFRleHQgPSBwYXJzZUludChNYXRoLmZsb29yKHByb2dyZXNzICogMTAwKSkgKyAnJSc7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0sIGZhbHNlKTtcblxuXHRcdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0XHRyZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRpbnB1dC5nZXQoMCkudmFsdWUgPSAnJztcblx0XHRcdH0pO1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2NvbnRhY3RJbXBvcnQuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignY29udGFjdGxpc3RDdHJsJywgZnVuY3Rpb24oJHNjb3BlLCAkZmlsdGVyLCAkcm91dGUsICRyb3V0ZVBhcmFtcywgQ29udGFjdFNlcnZpY2UsIHZDYXJkUHJvcGVydGllc1NlcnZpY2UsIFNlYXJjaFNlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwucm91dGVQYXJhbXMgPSAkcm91dGVQYXJhbXM7XG5cblx0Y3RybC5jb250YWN0TGlzdCA9IFtdO1xuXHRjdHJsLnNlYXJjaFRlcm0gPSAnJztcblx0Y3RybC5zaG93ID0gdHJ1ZTtcblx0Y3RybC5pbnZhbGlkID0gZmFsc2U7XG5cblx0Y3RybC50ID0ge1xuXHRcdGVtcHR5U2VhcmNoIDogdCgnY29udGFjdHMnLCAnTm8gc2VhcmNoIHJlc3VsdCBmb3Ige3F1ZXJ5fScsIHtxdWVyeTogY3RybC5zZWFyY2hUZXJtfSlcblx0fTtcblxuXHQkc2NvcGUuZ2V0Q291bnRTdHJpbmcgPSBmdW5jdGlvbihjb250YWN0cykge1xuXHRcdHJldHVybiBuKCdjb250YWN0cycsICclbiBjb250YWN0JywgJyVuIGNvbnRhY3RzJywgY29udGFjdHMubGVuZ3RoKTtcblx0fTtcblxuXHQkc2NvcGUucXVlcnkgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0cmV0dXJuIGNvbnRhY3QubWF0Y2hlcyhTZWFyY2hTZXJ2aWNlLmdldFNlYXJjaFRlcm0oKSk7XG5cdH07XG5cblx0U2VhcmNoU2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oZXYpIHtcblx0XHRpZiAoZXYuZXZlbnQgPT09ICdzdWJtaXRTZWFyY2gnKSB7XG5cdFx0XHR2YXIgdWlkID0gIV8uaXNFbXB0eShjdHJsLmNvbnRhY3RMaXN0KSA/IGN0cmwuY29udGFjdExpc3RbMF0udWlkKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQodWlkKTtcblx0XHRcdCRzY29wZS4kYXBwbHkoKTtcblx0XHR9XG5cdFx0aWYgKGV2LmV2ZW50ID09PSAnY2hhbmdlU2VhcmNoJykge1xuXHRcdFx0Y3RybC5zZWFyY2hUZXJtID0gZXYuc2VhcmNoVGVybTtcblx0XHRcdGN0cmwudC5lbXB0eVNlYXJjaCA9IHQoJ2NvbnRhY3RzJyxcblx0XHRcdFx0XHRcdFx0XHQgICAnTm8gc2VhcmNoIHJlc3VsdCBmb3Ige3F1ZXJ5fScsXG5cdFx0XHRcdFx0XHRcdFx0ICAge3F1ZXJ5OiBjdHJsLnNlYXJjaFRlcm19XG5cdFx0XHRcdFx0XHRcdFx0ICApO1xuXHRcdFx0JHNjb3BlLiRhcHBseSgpO1xuXHRcdH1cblx0fSk7XG5cblx0Y3RybC5sb2FkaW5nID0gdHJ1ZTtcblxuXHRDb250YWN0U2VydmljZS5yZWdpc3Rlck9ic2VydmVyQ2FsbGJhY2soZnVuY3Rpb24oZXYpIHtcblx0XHQkc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKGV2LmV2ZW50ID09PSAnZGVsZXRlJykge1xuXHRcdFx0XHRpZiAoY3RybC5jb250YWN0TGlzdC5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0XHQkcm91dGUudXBkYXRlUGFyYW1zKHtcblx0XHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHRcdHVpZDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9yICh2YXIgaSA9IDAsIGxlbmd0aCA9IGN0cmwuY29udGFjdExpc3QubGVuZ3RoOyBpIDwgbGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0XHRcdGlmIChjdHJsLmNvbnRhY3RMaXN0W2ldLnVpZCgpID09PSBldi51aWQpIHtcblx0XHRcdFx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0XHRcdHVpZDogKGN0cmwuY29udGFjdExpc3RbaSsxXSkgPyBjdHJsLmNvbnRhY3RMaXN0W2krMV0udWlkKCkgOiBjdHJsLmNvbnRhY3RMaXN0W2ktMV0udWlkKClcblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoZXYuZXZlbnQgPT09ICdjcmVhdGUnKSB7XG5cdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdGdpZDogJHJvdXRlUGFyYW1zLmdpZCxcblx0XHRcdFx0XHR1aWQ6IGV2LnVpZFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGN0cmwuY29udGFjdHMgPSBldi5jb250YWN0cztcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gR2V0IGNvbnRhY3RzXG5cdENvbnRhY3RTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24oY29udGFjdHMpIHtcblx0XHRpZihjb250YWN0cy5sZW5ndGg+MCkge1xuXHRcdFx0JHNjb3BlLiRhcHBseShmdW5jdGlvbigpIHtcblx0XHRcdFx0Y3RybC5jb250YWN0cyA9IGNvbnRhY3RzO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdH1cblx0fSk7XG5cblx0Ly8gV2FpdCBmb3IgY3RybC5jb250YWN0TGlzdCB0byBiZSB1cGRhdGVkLCBsb2FkIHRoZSBmaXJzdCBjb250YWN0IGFuZCBraWxsIHRoZSB3YXRjaFxuXHR2YXIgdW5iaW5kTGlzdFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdGlmKGN0cmwuY29udGFjdExpc3QgJiYgY3RybC5jb250YWN0TGlzdC5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBDaGVjayBpZiBhIHNwZWNpZmljIHVpZCBpcyByZXF1ZXN0ZWRcblx0XHRcdGlmKCRyb3V0ZVBhcmFtcy51aWQgJiYgJHJvdXRlUGFyYW1zLmdpZCkge1xuXHRcdFx0XHRjdHJsLmNvbnRhY3RMaXN0LmZvckVhY2goZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdFx0XHRcdGlmKGNvbnRhY3QudWlkKCkgPT09ICRyb3V0ZVBhcmFtcy51aWQpIHtcblx0XHRcdFx0XHRcdGN0cmwuc2V0U2VsZWN0ZWRJZCgkcm91dGVQYXJhbXMudWlkKTtcblx0XHRcdFx0XHRcdGN0cmwubG9hZGluZyA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBObyBjb250YWN0IHByZXZpb3VzbHkgbG9hZGVkLCBsZXQncyBsb2FkIHRoZSBmaXJzdCBvZiB0aGUgbGlzdCBpZiBub3QgaW4gbW9iaWxlIG1vZGVcblx0XHRcdGlmKGN0cmwubG9hZGluZyAmJiAkKHdpbmRvdykud2lkdGgoKSA+IDc2OCkge1xuXHRcdFx0XHRjdHJsLnNldFNlbGVjdGVkSWQoY3RybC5jb250YWN0TGlzdFswXS51aWQoKSk7XG5cdFx0XHR9XG5cdFx0XHRjdHJsLmxvYWRpbmcgPSBmYWxzZTtcblx0XHRcdHVuYmluZExpc3RXYXRjaCgpO1xuXHRcdH1cblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC5yb3V0ZVBhcmFtcy51aWQnLCBmdW5jdGlvbihuZXdWYWx1ZSwgb2xkVmFsdWUpIHtcblx0XHQvLyBVc2VkIGZvciBtb2JpbGUgdmlldyB0byBjbGVhciB0aGUgdXJsXG5cdFx0aWYodHlwZW9mIG9sZFZhbHVlICE9ICd1bmRlZmluZWQnICYmIHR5cGVvZiBuZXdWYWx1ZSA9PSAndW5kZWZpbmVkJyAmJiAkKHdpbmRvdykud2lkdGgoKSA8PSA3NjgpIHtcblx0XHRcdC8vIG5vIGNvbnRhY3Qgc2VsZWN0ZWRcblx0XHRcdGN0cmwuc2hvdyA9IHRydWU7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmKG5ld1ZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIHdlIG1pZ2h0IGhhdmUgdG8gd2FpdCB1bnRpbCBuZy1yZXBlYXQgZmlsbGVkIHRoZSBjb250YWN0TGlzdFxuXHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0JHJvdXRlLnVwZGF0ZVBhcmFtcyh7XG5cdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHdhdGNoIGZvciBuZXh0IGNvbnRhY3RMaXN0IHVwZGF0ZVxuXHRcdFx0XHR2YXIgdW5iaW5kV2F0Y2ggPSAkc2NvcGUuJHdhdGNoKCdjdHJsLmNvbnRhY3RMaXN0JywgZnVuY3Rpb24oKSB7XG5cdFx0XHRcdFx0aWYoY3RybC5jb250YWN0TGlzdCAmJiBjdHJsLmNvbnRhY3RMaXN0Lmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0XHRnaWQ6ICRyb3V0ZVBhcmFtcy5naWQsXG5cdFx0XHRcdFx0XHRcdHVpZDogY3RybC5jb250YWN0TGlzdFswXS51aWQoKVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHVuYmluZFdhdGNoKCk7IC8vIHVuYmluZCBhcyB3ZSBvbmx5IHdhbnQgb25lIHVwZGF0ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZGlzcGxheWluZyBjb250YWN0IGRldGFpbHNcblx0XHRcdGN0cmwuc2hvdyA9IGZhbHNlO1xuXHRcdH1cblx0fSk7XG5cblx0JHNjb3BlLiR3YXRjaCgnY3RybC5yb3V0ZVBhcmFtcy5naWQnLCBmdW5jdGlvbigpIHtcblx0XHQvLyB3ZSBtaWdodCBoYXZlIHRvIHdhaXQgdW50aWwgbmctcmVwZWF0IGZpbGxlZCB0aGUgY29udGFjdExpc3Rcblx0XHRjdHJsLmNvbnRhY3RMaXN0ID0gW107XG5cdFx0Ly8gbm90IGluIG1vYmlsZSBtb2RlXG5cdFx0aWYoJCh3aW5kb3cpLndpZHRoKCkgPiA3NjgpIHtcblx0XHRcdC8vIHdhdGNoIGZvciBuZXh0IGNvbnRhY3RMaXN0IHVwZGF0ZVxuXHRcdFx0dmFyIHVuYmluZFdhdGNoID0gJHNjb3BlLiR3YXRjaCgnY3RybC5jb250YWN0TGlzdCcsIGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRpZihjdHJsLmNvbnRhY3RMaXN0ICYmIGN0cmwuY29udGFjdExpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0XHRcdFx0Z2lkOiAkcm91dGVQYXJhbXMuZ2lkLFxuXHRcdFx0XHRcdFx0dWlkOiBjdHJsLmNvbnRhY3RMaXN0WzBdLnVpZCgpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dW5iaW5kV2F0Y2goKTsgLy8gdW5iaW5kIGFzIHdlIG9ubHkgd2FudCBvbmUgdXBkYXRlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdhdGNoIGlmIHdlIGhhdmUgYW4gaW52YWxpZCBjb250YWN0XG5cdCRzY29wZS4kd2F0Y2goJ2N0cmwuY29udGFjdExpc3RbMF0uZGlzcGxheU5hbWUoKScsIGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0Y3RybC5pbnZhbGlkID0gKGRpc3BsYXlOYW1lID09PSAnJyk7XG5cdH0pO1xuXG5cdGN0cmwuaGFzQ29udGFjdHMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKCFjdHJsLmNvbnRhY3RzKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiBjdHJsLmNvbnRhY3RzLmxlbmd0aCA+IDA7XG5cdH07XG5cblx0Y3RybC5zZXRTZWxlY3RlZElkID0gZnVuY3Rpb24gKGNvbnRhY3RJZCkge1xuXHRcdCRyb3V0ZS51cGRhdGVQYXJhbXMoe1xuXHRcdFx0dWlkOiBjb250YWN0SWRcblx0XHR9KTtcblx0fTtcblxuXHRjdHJsLmdldFNlbGVjdGVkSWQgPSBmdW5jdGlvbigpIHtcblx0XHRyZXR1cm4gJHJvdXRlUGFyYW1zLnVpZDtcblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnY29udGFjdGxpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRwcmlvcml0eTogMSxcblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2NvbnRhY3RsaXN0Q3RybCcsXG5cdFx0Y29udHJvbGxlckFzOiAnY3RybCcsXG5cdFx0YmluZFRvQ29udHJvbGxlcjoge1xuXHRcdFx0YWRkcmVzc2Jvb2s6ICc9YWRyYm9vaydcblx0XHR9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9jb250YWN0TGlzdC5odG1sJylcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5jb250cm9sbGVyKCdkZXRhaWxzSXRlbUN0cmwnLCBmdW5jdGlvbigkdGVtcGxhdGVSZXF1ZXN0LCB2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlLCBDb250YWN0U2VydmljZSkge1xuXHR2YXIgY3RybCA9IHRoaXM7XG5cblx0Y3RybC5tZXRhID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGN0cmwubmFtZSk7XG5cdGN0cmwudHlwZSA9IHVuZGVmaW5lZDtcblx0Y3RybC5pc1ByZWZlcnJlZCA9IGZhbHNlO1xuXHRjdHJsLnQgPSB7XG5cdFx0cG9Cb3ggOiB0KCdjb250YWN0cycsICdQb3N0IG9mZmljZSBib3gnKSxcblx0XHRwb3N0YWxDb2RlIDogdCgnY29udGFjdHMnLCAnUG9zdGFsIGNvZGUnKSxcblx0XHRjaXR5IDogdCgnY29udGFjdHMnLCAnQ2l0eScpLFxuXHRcdHN0YXRlIDogdCgnY29udGFjdHMnLCAnU3RhdGUgb3IgcHJvdmluY2UnKSxcblx0XHRjb3VudHJ5IDogdCgnY29udGFjdHMnLCAnQ291bnRyeScpLFxuXHRcdGFkZHJlc3M6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MnKSxcblx0XHRuZXdHcm91cDogdCgnY29udGFjdHMnLCAnKG5ldyBncm91cCknKSxcblx0XHRmYW1pbHlOYW1lOiB0KCdjb250YWN0cycsICdMYXN0IG5hbWUnKSxcblx0XHRmaXJzdE5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZpcnN0IG5hbWUnKSxcblx0XHRhZGRpdGlvbmFsTmFtZXM6IHQoJ2NvbnRhY3RzJywgJ0FkZGl0aW9uYWwgbmFtZXMnKSxcblx0XHRob25vcmlmaWNQcmVmaXg6IHQoJ2NvbnRhY3RzJywgJ1ByZWZpeCcpLFxuXHRcdGhvbm9yaWZpY1N1ZmZpeDogdCgnY29udGFjdHMnLCAnU3VmZml4JyksXG5cdFx0ZGVsZXRlOiB0KCdjb250YWN0cycsICdEZWxldGUnKVxuXHR9O1xuXG5cdGN0cmwuYXZhaWxhYmxlT3B0aW9ucyA9IGN0cmwubWV0YS5vcHRpb25zIHx8IFtdO1xuXHRpZiAoIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhKSAmJiAhXy5pc1VuZGVmaW5lZChjdHJsLmRhdGEubWV0YSkgJiYgIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhLm1ldGEudHlwZSkpIHtcblx0XHQvLyBwYXJzZSB0eXBlIG9mIHRoZSBwcm9wZXJ0eVxuXHRcdHZhciBhcnJheSA9IGN0cmwuZGF0YS5tZXRhLnR5cGVbMF0uc3BsaXQoJywnKTtcblx0XHRhcnJheSA9IGFycmF5Lm1hcChmdW5jdGlvbiAoZWxlbSkge1xuXHRcdFx0cmV0dXJuIGVsZW0udHJpbSgpLnJlcGxhY2UoL1xcLyskLywgJycpLnJlcGxhY2UoL1xcXFwrJC8sICcnKS50cmltKCkudG9VcHBlckNhc2UoKTtcblx0XHR9KTtcblx0XHQvLyB0aGUgcHJlZiB2YWx1ZSBpcyBoYW5kbGVkIG9uIGl0cyBvd24gc28gdGhhdCB3ZSBjYW4gYWRkIHNvbWUgZmF2b3JpdGUgaWNvbiB0byB0aGUgdWkgaWYgd2Ugd2FudFxuXHRcdGlmIChhcnJheS5pbmRleE9mKCdQUkVGJykgPj0gMCkge1xuXHRcdFx0Y3RybC5pc1ByZWZlcnJlZCA9IHRydWU7XG5cdFx0XHRhcnJheS5zcGxpY2UoYXJyYXkuaW5kZXhPZignUFJFRicpLCAxKTtcblx0XHR9XG5cdFx0Ly8gc2ltcGx5IGpvaW4gdGhlIHVwcGVyIGNhc2VkIHR5cGVzIHRvZ2V0aGVyIGFzIGtleVxuXHRcdGN0cmwudHlwZSA9IGFycmF5LmpvaW4oJywnKTtcblx0XHR2YXIgZGlzcGxheU5hbWUgPSBhcnJheS5tYXAoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdHJldHVybiBlbGVtZW50LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgZWxlbWVudC5zbGljZSgxKS50b0xvd2VyQ2FzZSgpO1xuXHRcdH0pLmpvaW4oJyAnKTtcblxuXHRcdC8vIGluIGNhc2UgdGhlIHR5cGUgaXMgbm90IHlldCBpbiB0aGUgZGVmYXVsdCBsaXN0IG9mIGF2YWlsYWJsZSBvcHRpb25zIHdlIGFkZCBpdFxuXHRcdGlmICghY3RybC5hdmFpbGFibGVPcHRpb25zLnNvbWUoZnVuY3Rpb24oZSkgeyByZXR1cm4gZS5pZCA9PT0gY3RybC50eXBlOyB9ICkpIHtcblx0XHRcdGN0cmwuYXZhaWxhYmxlT3B0aW9ucyA9IGN0cmwuYXZhaWxhYmxlT3B0aW9ucy5jb25jYXQoW3tpZDogY3RybC50eXBlLCBuYW1lOiBkaXNwbGF5TmFtZX1dKTtcblx0XHR9XG5cdH1cblx0aWYgKCFfLmlzVW5kZWZpbmVkKGN0cmwuZGF0YSkgJiYgIV8uaXNVbmRlZmluZWQoY3RybC5kYXRhLm5hbWVzcGFjZSkpIHtcblx0XHRpZiAoIV8uaXNVbmRlZmluZWQoY3RybC5tb2RlbC5jb250YWN0LnByb3BzWydYLUFCTEFCRUwnXSkpIHtcblx0XHRcdHZhciB2YWwgPSBfLmZpbmQodGhpcy5tb2RlbC5jb250YWN0LnByb3BzWydYLUFCTEFCRUwnXSwgZnVuY3Rpb24oeCkgeyByZXR1cm4geC5uYW1lc3BhY2UgPT09IGN0cmwuZGF0YS5uYW1lc3BhY2U7IH0pO1xuXHRcdFx0Y3RybC50eXBlID0gdmFsLnZhbHVlO1xuXHRcdFx0aWYgKCFfLmlzVW5kZWZpbmVkKHZhbCkpIHtcblx0XHRcdFx0Ly8gaW4gY2FzZSB0aGUgdHlwZSBpcyBub3QgeWV0IGluIHRoZSBkZWZhdWx0IGxpc3Qgb2YgYXZhaWxhYmxlIG9wdGlvbnMgd2UgYWRkIGl0XG5cdFx0XHRcdGlmICghY3RybC5hdmFpbGFibGVPcHRpb25zLnNvbWUoZnVuY3Rpb24oZSkgeyByZXR1cm4gZS5pZCA9PT0gdmFsLnZhbHVlOyB9ICkpIHtcblx0XHRcdFx0XHRjdHJsLmF2YWlsYWJsZU9wdGlvbnMgPSBjdHJsLmF2YWlsYWJsZU9wdGlvbnMuY29uY2F0KFt7aWQ6IHZhbC52YWx1ZSwgbmFtZTogdmFsLnZhbHVlfV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdGN0cmwuYXZhaWxhYmxlR3JvdXBzID0gW107XG5cblx0Q29udGFjdFNlcnZpY2UuZ2V0R3JvdXBzKCkudGhlbihmdW5jdGlvbihncm91cHMpIHtcblx0XHRjdHJsLmF2YWlsYWJsZUdyb3VwcyA9IF8udW5pcXVlKGdyb3Vwcyk7XG5cdH0pO1xuXG5cdGN0cmwuY2hhbmdlVHlwZSA9IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRpZiAoY3RybC5pc1ByZWZlcnJlZCkge1xuXHRcdFx0dmFsICs9ICcsUFJFRic7XG5cdFx0fVxuXHRcdGN0cmwuZGF0YS5tZXRhID0gY3RybC5kYXRhLm1ldGEgfHwge307XG5cdFx0Y3RybC5kYXRhLm1ldGEudHlwZSA9IGN0cmwuZGF0YS5tZXRhLnR5cGUgfHwgW107XG5cdFx0Y3RybC5kYXRhLm1ldGEudHlwZVswXSA9IHZhbDtcblx0XHRjdHJsLm1vZGVsLnVwZGF0ZUNvbnRhY3QoKTtcblx0fTtcblxuXHRjdHJsLnVwZGF0ZURldGFpbGVkTmFtZSA9IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgZm4gPSAnJztcblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzNdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbM10gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbMV0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVsxXSArICcgJztcblx0XHR9XG5cdFx0aWYgKGN0cmwuZGF0YS52YWx1ZVsyXSkge1xuXHRcdFx0Zm4gKz0gY3RybC5kYXRhLnZhbHVlWzJdICsgJyAnO1xuXHRcdH1cblx0XHRpZiAoY3RybC5kYXRhLnZhbHVlWzBdKSB7XG5cdFx0XHRmbiArPSBjdHJsLmRhdGEudmFsdWVbMF0gKyAnICc7XG5cdFx0fVxuXHRcdGlmIChjdHJsLmRhdGEudmFsdWVbNF0pIHtcblx0XHRcdGZuICs9IGN0cmwuZGF0YS52YWx1ZVs0XTtcblx0XHR9XG5cblx0XHRjdHJsLm1vZGVsLmNvbnRhY3QuZnVsbE5hbWUoZm4pO1xuXHRcdGN0cmwubW9kZWwudXBkYXRlQ29udGFjdCgpO1xuXHR9O1xuXG5cdGN0cmwuZ2V0VGVtcGxhdGUgPSBmdW5jdGlvbigpIHtcblx0XHR2YXIgdGVtcGxhdGVVcmwgPSBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9kZXRhaWxJdGVtcy8nICsgY3RybC5tZXRhLnRlbXBsYXRlICsgJy5odG1sJyk7XG5cdFx0cmV0dXJuICR0ZW1wbGF0ZVJlcXVlc3QodGVtcGxhdGVVcmwpO1xuXHR9O1xuXG5cdGN0cmwuZGVsZXRlRmllbGQgPSBmdW5jdGlvbiAoKSB7XG5cdFx0Y3RybC5tb2RlbC5kZWxldGVGaWVsZChjdHJsLm5hbWUsIGN0cmwuZGF0YSk7XG5cdFx0Y3RybC5tb2RlbC51cGRhdGVDb250YWN0KCk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdkZXRhaWxzaXRlbScsIFsnJGNvbXBpbGUnLCBmdW5jdGlvbigkY29tcGlsZSkge1xuXHRyZXR1cm4ge1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnZGV0YWlsc0l0ZW1DdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7XG5cdFx0XHRuYW1lOiAnPScsXG5cdFx0XHRkYXRhOiAnPScsXG5cdFx0XHRtb2RlbDogJz0nXG5cdFx0fSxcblx0XHRsaW5rOiBmdW5jdGlvbihzY29wZSwgZWxlbWVudCwgYXR0cnMsIGN0cmwpIHtcblx0XHRcdGN0cmwuZ2V0VGVtcGxhdGUoKS50aGVuKGZ1bmN0aW9uKGh0bWwpIHtcblx0XHRcdFx0dmFyIHRlbXBsYXRlID0gYW5ndWxhci5lbGVtZW50KGh0bWwpO1xuXHRcdFx0XHRlbGVtZW50LmFwcGVuZCh0ZW1wbGF0ZSk7XG5cdFx0XHRcdCRjb21waWxlKHRlbXBsYXRlKShzY29wZSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH07XG59XSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2dyb3VwQ3RybCcsIGZ1bmN0aW9uKCkge1xuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcblx0dmFyIGN0cmwgPSB0aGlzO1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnZ3JvdXAnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0EnLCAvLyBoYXMgdG8gYmUgYW4gYXR0cmlidXRlIHRvIHdvcmsgd2l0aCBjb3JlIGNzc1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnZ3JvdXBDdHJsJyxcblx0XHRjb250cm9sbGVyQXM6ICdjdHJsJyxcblx0XHRiaW5kVG9Db250cm9sbGVyOiB7XG5cdFx0XHRncm91cDogJz1kYXRhJ1xuXHRcdH0sXG5cdFx0dGVtcGxhdGVVcmw6IE9DLmxpbmtUbygnY29udGFjdHMnLCAndGVtcGxhdGVzL2dyb3VwLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmNvbnRyb2xsZXIoJ2dyb3VwbGlzdEN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIENvbnRhY3RTZXJ2aWNlLCBTZWFyY2hTZXJ2aWNlLCAkcm91dGVQYXJhbXMpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdHZhciBpbml0aWFsR3JvdXBzID0gW3QoJ2NvbnRhY3RzJywgJ0FsbCBjb250YWN0cycpLCB0KCdjb250YWN0cycsICdOb3QgZ3JvdXBlZCcpXTtcblxuXHRjdHJsLmdyb3VwcyA9IGluaXRpYWxHcm91cHM7XG5cblx0Q29udGFjdFNlcnZpY2UuZ2V0R3JvdXBzKCkudGhlbihmdW5jdGlvbihncm91cHMpIHtcblx0XHRjdHJsLmdyb3VwcyA9IF8udW5pcXVlKGluaXRpYWxHcm91cHMuY29uY2F0KGdyb3VwcykpO1xuXHR9KTtcblxuXHRjdHJsLmdldFNlbGVjdGVkID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuICRyb3V0ZVBhcmFtcy5naWQ7XG5cdH07XG5cblx0Ly8gVXBkYXRlIGdyb3VwTGlzdCBvbiBjb250YWN0IGFkZC9kZWxldGUvdXBkYXRlXG5cdENvbnRhY3RTZXJ2aWNlLnJlZ2lzdGVyT2JzZXJ2ZXJDYWxsYmFjayhmdW5jdGlvbigpIHtcblx0XHQkc2NvcGUuJGFwcGx5KGZ1bmN0aW9uKCkge1xuXHRcdFx0Q29udGFjdFNlcnZpY2UuZ2V0R3JvdXBzKCkudGhlbihmdW5jdGlvbihncm91cHMpIHtcblx0XHRcdFx0Y3RybC5ncm91cHMgPSBfLnVuaXF1ZShpbml0aWFsR3JvdXBzLmNvbmNhdChncm91cHMpKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRjdHJsLnNldFNlbGVjdGVkID0gZnVuY3Rpb24gKHNlbGVjdGVkR3JvdXApIHtcblx0XHRTZWFyY2hTZXJ2aWNlLmNsZWFuU2VhcmNoKCk7XG5cdFx0JHJvdXRlUGFyYW1zLmdpZCA9IHNlbGVjdGVkR3JvdXA7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZGlyZWN0aXZlKCdncm91cGxpc3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHtcblx0XHRyZXN0cmljdDogJ0VBJywgLy8gaGFzIHRvIGJlIGFuIGF0dHJpYnV0ZSB0byB3b3JrIHdpdGggY29yZSBjc3Ncblx0XHRzY29wZToge30sXG5cdFx0Y29udHJvbGxlcjogJ2dyb3VwbGlzdEN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9ncm91cExpc3QuaHRtbCcpXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uY29udHJvbGxlcignbmV3Q29udGFjdEJ1dHRvbkN0cmwnLCBmdW5jdGlvbigkc2NvcGUsIENvbnRhY3RTZXJ2aWNlLCAkcm91dGVQYXJhbXMsIHZDYXJkUHJvcGVydGllc1NlcnZpY2UpIHtcblx0dmFyIGN0cmwgPSB0aGlzO1xuXG5cdGN0cmwudCA9IHtcblx0XHRhZGRDb250YWN0IDogdCgnY29udGFjdHMnLCAnTmV3IGNvbnRhY3QnKVxuXHR9O1xuXG5cdGN0cmwuY3JlYXRlQ29udGFjdCA9IGZ1bmN0aW9uKCkge1xuXHRcdENvbnRhY3RTZXJ2aWNlLmNyZWF0ZSgpLnRoZW4oZnVuY3Rpb24oY29udGFjdCkge1xuXHRcdFx0Wyd0ZWwnLCAnYWRyJywgJ2VtYWlsJ10uZm9yRWFjaChmdW5jdGlvbihmaWVsZCkge1xuXHRcdFx0XHR2YXIgZGVmYXVsdFZhbHVlID0gdkNhcmRQcm9wZXJ0aWVzU2VydmljZS5nZXRNZXRhKGZpZWxkKS5kZWZhdWx0VmFsdWUgfHwge3ZhbHVlOiAnJ307XG5cdFx0XHRcdGNvbnRhY3QuYWRkUHJvcGVydHkoZmllbGQsIGRlZmF1bHRWYWx1ZSk7XG5cdFx0XHR9ICk7XG5cdFx0XHRpZiAoW3QoJ2NvbnRhY3RzJywgJ0FsbCBjb250YWN0cycpLCB0KCdjb250YWN0cycsICdOb3QgZ3JvdXBlZCcpXS5pbmRleE9mKCRyb3V0ZVBhcmFtcy5naWQpID09PSAtMSkge1xuXHRcdFx0XHRjb250YWN0LmNhdGVnb3JpZXMoJHJvdXRlUGFyYW1zLmdpZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb250YWN0LmNhdGVnb3JpZXMoJycpO1xuXHRcdFx0fVxuXHRcdFx0JCgnI2RldGFpbHMtZnVsbE5hbWUnKS5mb2N1cygpO1xuXHRcdH0pO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgnbmV3Y29udGFjdGJ1dHRvbicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4ge1xuXHRcdHJlc3RyaWN0OiAnRUEnLCAvLyBoYXMgdG8gYmUgYW4gYXR0cmlidXRlIHRvIHdvcmsgd2l0aCBjb3JlIGNzc1xuXHRcdHNjb3BlOiB7fSxcblx0XHRjb250cm9sbGVyOiAnbmV3Q29udGFjdEJ1dHRvbkN0cmwnLFxuXHRcdGNvbnRyb2xsZXJBczogJ2N0cmwnLFxuXHRcdGJpbmRUb0NvbnRyb2xsZXI6IHt9LFxuXHRcdHRlbXBsYXRlVXJsOiBPQy5saW5rVG8oJ2NvbnRhY3RzJywgJ3RlbXBsYXRlcy9uZXdDb250YWN0QnV0dG9uLmh0bWwnKVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmRpcmVjdGl2ZSgndGVsTW9kZWwnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJue1xuXHRcdHJlc3RyaWN0OiAnQScsXG5cdFx0cmVxdWlyZTogJ25nTW9kZWwnLFxuXHRcdGxpbms6IGZ1bmN0aW9uKHNjb3BlLCBlbGVtZW50LCBhdHRyLCBuZ01vZGVsKSB7XG5cdFx0XHRuZ01vZGVsLiRmb3JtYXR0ZXJzLnB1c2goZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSk7XG5cdFx0XHRuZ01vZGVsLiRwYXJzZXJzLnB1c2goZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZhY3RvcnkoJ0FkZHJlc3NCb29rJywgZnVuY3Rpb24oKVxue1xuXHRyZXR1cm4gZnVuY3Rpb24gQWRkcmVzc0Jvb2soZGF0YSkge1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIHtcblxuXHRcdFx0ZGlzcGxheU5hbWU6ICcnLFxuXHRcdFx0Y29udGFjdHM6IFtdLFxuXHRcdFx0Z3JvdXBzOiBkYXRhLmRhdGEucHJvcHMuZ3JvdXBzLFxuXG5cdFx0XHRnZXRDb250YWN0OiBmdW5jdGlvbih1aWQpIHtcblx0XHRcdFx0Zm9yKHZhciBpIGluIHRoaXMuY29udGFjdHMpIHtcblx0XHRcdFx0XHRpZih0aGlzLmNvbnRhY3RzW2ldLnVpZCgpID09PSB1aWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmNvbnRhY3RzW2ldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblxuXHRcdFx0c2hhcmVkV2l0aDoge1xuXHRcdFx0XHR1c2VyczogW10sXG5cdFx0XHRcdGdyb3VwczogW11cblx0XHRcdH1cblxuXHRcdH0pO1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIGRhdGEpO1xuXHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMsIHtcblx0XHRcdG93bmVyOiBkYXRhLnVybC5zcGxpdCgnLycpLnNsaWNlKC0zLCAtMilbMF1cblx0XHR9KTtcblxuXHRcdHZhciBzaGFyZXMgPSB0aGlzLmRhdGEucHJvcHMuaW52aXRlO1xuXHRcdGlmICh0eXBlb2Ygc2hhcmVzICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCBzaGFyZXMubGVuZ3RoOyBqKyspIHtcblx0XHRcdFx0dmFyIGhyZWYgPSBzaGFyZXNbal0uaHJlZjtcblx0XHRcdFx0aWYgKGhyZWYubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIGFjY2VzcyA9IHNoYXJlc1tqXS5hY2Nlc3M7XG5cdFx0XHRcdGlmIChhY2Nlc3MubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR2YXIgcmVhZFdyaXRlID0gKHR5cGVvZiBhY2Nlc3MucmVhZFdyaXRlICE9PSAndW5kZWZpbmVkJyk7XG5cblx0XHRcdFx0aWYgKGhyZWYuc3RhcnRzV2l0aCgncHJpbmNpcGFsOnByaW5jaXBhbHMvdXNlcnMvJykpIHtcblx0XHRcdFx0XHR0aGlzLnNoYXJlZFdpdGgudXNlcnMucHVzaCh7XG5cdFx0XHRcdFx0XHRpZDogaHJlZi5zdWJzdHIoMjcpLFxuXHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IGhyZWYuc3Vic3RyKDI3KSxcblx0XHRcdFx0XHRcdHdyaXRhYmxlOiByZWFkV3JpdGVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIGlmIChocmVmLnN0YXJ0c1dpdGgoJ3ByaW5jaXBhbDpwcmluY2lwYWxzL2dyb3Vwcy8nKSkge1xuXHRcdFx0XHRcdHRoaXMuc2hhcmVkV2l0aC5ncm91cHMucHVzaCh7XG5cdFx0XHRcdFx0XHRpZDogaHJlZi5zdWJzdHIoMjgpLFxuXHRcdFx0XHRcdFx0ZGlzcGxheW5hbWU6IGhyZWYuc3Vic3RyKDI4KSxcblx0XHRcdFx0XHRcdHdyaXRhYmxlOiByZWFkV3JpdGVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vdmFyIG93bmVyID0gdGhpcy5kYXRhLnByb3BzLm93bmVyO1xuXHRcdC8vaWYgKHR5cGVvZiBvd25lciAhPT0gJ3VuZGVmaW5lZCcgJiYgb3duZXIubGVuZ3RoICE9PSAwKSB7XG5cdFx0Ly9cdG93bmVyID0gb3duZXIudHJpbSgpO1xuXHRcdC8vXHRpZiAob3duZXIuc3RhcnRzV2l0aCgnL3JlbW90ZS5waHAvZGF2L3ByaW5jaXBhbHMvdXNlcnMvJykpIHtcblx0XHQvL1x0XHR0aGlzLl9wcm9wZXJ0aWVzLm93bmVyID0gb3duZXIuc3Vic3RyKDMzKTtcblx0XHQvL1x0fVxuXHRcdC8vfVxuXG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmFjdG9yeSgnQ29udGFjdCcsIGZ1bmN0aW9uKCRmaWx0ZXIpIHtcblx0cmV0dXJuIGZ1bmN0aW9uIENvbnRhY3QoYWRkcmVzc0Jvb2ssIHZDYXJkKSB7XG5cdFx0YW5ndWxhci5leHRlbmQodGhpcywge1xuXG5cdFx0XHRkYXRhOiB7fSxcblx0XHRcdHByb3BzOiB7fSxcblx0XHRcdGZhaWxlZFByb3BzOiBbXSxcblxuXHRcdFx0ZGF0ZVByb3BlcnRpZXM6IFsnYmRheScsICdhbm5pdmVyc2FyeScsICdkZWF0aGRhdGUnXSxcblxuXHRcdFx0YWRkcmVzc0Jvb2tJZDogYWRkcmVzc0Jvb2suZGlzcGxheU5hbWUsXG5cblx0XHRcdHZlcnNpb246IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCd2ZXJzaW9uJyk7XG5cdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cblx0XHRcdHVpZDogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiBtb2RlbC5zZXRQcm9wZXJ0eSgndWlkJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0cmV0dXJuIG1vZGVsLmdldFByb3BlcnR5KCd1aWQnKS52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0ZGlzcGxheU5hbWU6IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHR2YXIgZGlzcGxheU5hbWUgPSB0aGlzLmZ1bGxOYW1lKCkgfHwgdGhpcy5vcmcoKSB8fCAnJztcblx0XHRcdFx0aWYoYW5ndWxhci5pc0FycmF5KGRpc3BsYXlOYW1lKSkge1xuXHRcdFx0XHRcdHJldHVybiBkaXNwbGF5TmFtZS5qb2luKCcgJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGRpc3BsYXlOYW1lO1xuXHRcdFx0fSxcblxuXHRcdFx0cmVhZGFibGVGaWxlbmFtZTogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdGlmKHRoaXMuZGlzcGxheU5hbWUoKSkge1xuXHRcdFx0XHRcdHJldHVybiAodGhpcy5kaXNwbGF5TmFtZSgpKSArICcudmNmJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBmYWxsYmFjayB0byBkZWZhdWx0IGZpbGVuYW1lIChzZWUgZG93bmxvYWQgYXR0cmlidXRlKVxuXHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0fVxuXG5cdFx0XHR9LFxuXG5cdFx0XHRmdWxsTmFtZTogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCdmbicsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IG1vZGVsLmdldFByb3BlcnR5KCdmbicpO1xuXHRcdFx0XHRcdGlmKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHByb3BlcnR5ID0gbW9kZWwuZ2V0UHJvcGVydHkoJ24nKTtcblx0XHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlLmZpbHRlcihmdW5jdGlvbihlbGVtKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBlbGVtO1xuXHRcdFx0XHRcdFx0fSkuam9pbignICcpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHR0aXRsZTogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCd0aXRsZScsIHsgdmFsdWU6IHZhbHVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ3RpdGxlJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cblx0XHRcdG9yZzogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy5nZXRQcm9wZXJ0eSgnb3JnJyk7XG5cdFx0XHRcdGlmIChhbmd1bGFyLmlzRGVmaW5lZCh2YWx1ZSkpIHtcblx0XHRcdFx0XHR2YXIgdmFsID0gdmFsdWU7XG5cdFx0XHRcdFx0Ly8gc2V0dGVyXG5cdFx0XHRcdFx0aWYocHJvcGVydHkgJiYgQXJyYXkuaXNBcnJheShwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0XHRcdHZhbCA9IHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdFx0dmFsWzBdID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCdvcmcnLCB7IHZhbHVlOiB2YWwgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWVbMF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRlbWFpbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIGdldHRlclxuXHRcdFx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdlbWFpbCcpO1xuXHRcdFx0XHRpZihwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRwaG90bzogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdC8vIHNwbGl0cyBpbWFnZSBkYXRhIGludG8gXCJkYXRhOmltYWdlL2pwZWdcIiBhbmQgYmFzZSA2NCBlbmNvZGVkIGltYWdlXG5cdFx0XHRcdFx0dmFyIGltYWdlRGF0YSA9IHZhbHVlLnNwbGl0KCc7YmFzZTY0LCcpO1xuXHRcdFx0XHRcdHZhciBpbWFnZVR5cGUgPSBpbWFnZURhdGFbMF0uc2xpY2UoJ2RhdGE6Jy5sZW5ndGgpO1xuXHRcdFx0XHRcdGlmICghaW1hZ2VUeXBlLnN0YXJ0c1dpdGgoJ2ltYWdlLycpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGltYWdlVHlwZSA9IGltYWdlVHlwZS5zdWJzdHJpbmcoNikudG9VcHBlckNhc2UoKTtcblxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCdwaG90bycsIHsgdmFsdWU6IGltYWdlRGF0YVsxXSwgbWV0YToge3R5cGU6IFtpbWFnZVR5cGVdLCBlbmNvZGluZzogWydiJ119IH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhciBwcm9wZXJ0eSA9IHRoaXMuZ2V0UHJvcGVydHkoJ3Bob3RvJyk7XG5cdFx0XHRcdFx0aWYocHJvcGVydHkpIHtcblx0XHRcdFx0XHRcdHZhciB0eXBlID0gcHJvcGVydHkubWV0YS50eXBlO1xuXHRcdFx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNVbmRlZmluZWQodHlwZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChhbmd1bGFyLmlzQXJyYXkodHlwZSkpIHtcblx0XHRcdFx0XHRcdFx0dHlwZSA9IHR5cGVbMF07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoIXR5cGUuc3RhcnRzV2l0aCgnaW1hZ2UvJykpIHtcblx0XHRcdFx0XHRcdFx0dHlwZSA9ICdpbWFnZS8nICsgdHlwZS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuICdkYXRhOicgKyB0eXBlICsgJztiYXNlNjQsJyArIHByb3BlcnR5LnZhbHVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblxuXHRcdFx0Y2F0ZWdvcmllczogZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNEZWZpbmVkKHZhbHVlKSkge1xuXHRcdFx0XHRcdC8vIHNldHRlclxuXHRcdFx0XHRcdHJldHVybiB0aGlzLnNldFByb3BlcnR5KCdjYXRlZ29yaWVzJywgeyB2YWx1ZTogdmFsdWUgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gZ2V0dGVyXG5cdFx0XHRcdFx0dmFyIHByb3BlcnR5ID0gdGhpcy52YWxpZGF0ZSgnY2F0ZWdvcmllcycsIHRoaXMuZ2V0UHJvcGVydHkoJ2NhdGVnb3JpZXMnKSk7XG5cdFx0XHRcdFx0aWYoIXByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChhbmd1bGFyLmlzQXJyYXkocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvcGVydHkudmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBbcHJvcGVydHkudmFsdWVdO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXG5cdFx0XHRmb3JtYXREYXRlQXNSRkM2MzUwOiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKGRhdGEpIHx8IF8uaXNVbmRlZmluZWQoZGF0YS52YWx1ZSkpIHtcblx0XHRcdFx0XHRyZXR1cm4gZGF0YTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5kYXRlUHJvcGVydGllcy5pbmRleE9mKG5hbWUpICE9PSAtMSkge1xuXHRcdFx0XHRcdHZhciBtYXRjaCA9IGRhdGEudmFsdWUubWF0Y2goL14oXFxkezR9KS0oXFxkezJ9KS0oXFxkezJ9KSQvKTtcblx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdGRhdGEudmFsdWUgPSBtYXRjaFsxXSArIG1hdGNoWzJdICsgbWF0Y2hbM107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHR9LFxuXG5cdFx0XHRmb3JtYXREYXRlRm9yRGlzcGxheTogZnVuY3Rpb24obmFtZSwgZGF0YSkge1xuXHRcdFx0XHRpZiAoXy5pc1VuZGVmaW5lZChkYXRhKSB8fCBfLmlzVW5kZWZpbmVkKGRhdGEudmFsdWUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZGF0ZVByb3BlcnRpZXMuaW5kZXhPZihuYW1lKSAhPT0gLTEpIHtcblx0XHRcdFx0XHR2YXIgbWF0Y2ggPSBkYXRhLnZhbHVlLm1hdGNoKC9eKFxcZHs0fSkoXFxkezJ9KShcXGR7Mn0pJC8pO1xuXHRcdFx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRcdFx0ZGF0YS52YWx1ZSA9IG1hdGNoWzFdICsgJy0nICsgbWF0Y2hbMl0gKyAnLScgKyBtYXRjaFszXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZGF0YTtcblx0XHRcdH0sXG5cblx0XHRcdGdldFByb3BlcnR5OiBmdW5jdGlvbihuYW1lKSB7XG5cdFx0XHRcdGlmICh0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZm9ybWF0RGF0ZUZvckRpc3BsYXkobmFtZSwgdGhpcy5wcm9wc1tuYW1lXVswXSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZFByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGRhdGEgPSBhbmd1bGFyLmNvcHkoZGF0YSk7XG5cdFx0XHRcdGRhdGEgPSB0aGlzLmZvcm1hdERhdGVBc1JGQzYzNTAobmFtZSwgZGF0YSk7XG5cdFx0XHRcdGlmKCF0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXSA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHZhciBpZHggPSB0aGlzLnByb3BzW25hbWVdLmxlbmd0aDtcblx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXVtpZHhdID0gZGF0YTtcblxuXHRcdFx0XHQvLyBrZWVwIHZDYXJkIGluIHN5bmNcblx0XHRcdFx0dGhpcy5kYXRhLmFkZHJlc3NEYXRhID0gJGZpbHRlcignSlNPTjJ2Q2FyZCcpKHRoaXMucHJvcHMpO1xuXHRcdFx0XHRyZXR1cm4gaWR4O1xuXHRcdFx0fSxcblx0XHRcdHNldFByb3BlcnR5OiBmdW5jdGlvbihuYW1lLCBkYXRhKSB7XG5cdFx0XHRcdGlmKCF0aGlzLnByb3BzW25hbWVdKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm9wc1tuYW1lXSA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRhdGEgPSB0aGlzLmZvcm1hdERhdGVBc1JGQzYzNTAobmFtZSwgZGF0YSk7XG5cdFx0XHRcdHRoaXMucHJvcHNbbmFtZV1bMF0gPSBkYXRhO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVtb3ZlUHJvcGVydHk6IGZ1bmN0aW9uIChuYW1lLCBwcm9wKSB7XG5cdFx0XHRcdGFuZ3VsYXIuY29weShfLndpdGhvdXQodGhpcy5wcm9wc1tuYW1lXSwgcHJvcCksIHRoaXMucHJvcHNbbmFtZV0pO1xuXHRcdFx0XHR0aGlzLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykodGhpcy5wcm9wcyk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0RVRhZzogZnVuY3Rpb24oZXRhZykge1xuXHRcdFx0XHR0aGlzLmRhdGEuZXRhZyA9IGV0YWc7XG5cdFx0XHR9LFxuXHRcdFx0c2V0VXJsOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgdWlkKSB7XG5cdFx0XHRcdHRoaXMuZGF0YS51cmwgPSBhZGRyZXNzQm9vay51cmwgKyB1aWQgKyAnLnZjZic7XG5cdFx0XHR9LFxuXG5cdFx0XHRnZXRJU09EYXRlOiBmdW5jdGlvbihkYXRlKSB7XG5cdFx0XHRcdGZ1bmN0aW9uIHBhZChudW1iZXIpIHtcblx0XHRcdFx0XHRpZiAobnVtYmVyIDwgMTApIHtcblx0XHRcdFx0XHRcdHJldHVybiAnMCcgKyBudW1iZXI7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiAnJyArIG51bWJlcjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBkYXRlLmdldFVUQ0Z1bGxZZWFyKCkgKyAnJyArXG5cdFx0XHRcdFx0XHRwYWQoZGF0ZS5nZXRVVENNb250aCgpICsgMSkgK1xuXHRcdFx0XHRcdFx0cGFkKGRhdGUuZ2V0VVRDRGF0ZSgpKSArXG5cdFx0XHRcdFx0XHQnVCcgKyBwYWQoZGF0ZS5nZXRVVENIb3VycygpKSArXG5cdFx0XHRcdFx0XHRwYWQoZGF0ZS5nZXRVVENNaW51dGVzKCkpICtcblx0XHRcdFx0XHRcdHBhZChkYXRlLmdldFVUQ1NlY29uZHMoKSkgKyAnWic7XG5cdFx0XHR9LFxuXG5cdFx0XHRzeW5jVkNhcmQ6IGZ1bmN0aW9uKCkge1xuXG5cdFx0XHRcdHRoaXMuc2V0UHJvcGVydHkoJ3JldicsIHsgdmFsdWU6IHRoaXMuZ2V0SVNPRGF0ZShuZXcgRGF0ZSgpKSB9KTtcblx0XHRcdFx0dmFyIHNlbGYgPSB0aGlzO1xuXG5cdFx0XHRcdF8uZWFjaCh0aGlzLmRhdGVQcm9wZXJ0aWVzLCBmdW5jdGlvbihuYW1lKSB7XG5cdFx0XHRcdFx0aWYgKCFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV0pICYmICFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV1bMF0pKSB7XG5cdFx0XHRcdFx0XHQvLyBTZXQgZGF0ZXMgYWdhaW4gdG8gbWFrZSBzdXJlIHRoZXkgYXJlIGluIFJGQy02MzUwIGZvcm1hdFxuXHRcdFx0XHRcdFx0c2VsZi5zZXRQcm9wZXJ0eShuYW1lLCBzZWxmLnByb3BzW25hbWVdWzBdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHQvLyBmb3JjZSBmbiB0byBiZSBzZXRcblx0XHRcdFx0dGhpcy5mdWxsTmFtZSh0aGlzLmZ1bGxOYW1lKCkpO1xuXG5cdFx0XHRcdC8vIGtlZXAgdkNhcmQgaW4gc3luY1xuXHRcdFx0XHRzZWxmLmRhdGEuYWRkcmVzc0RhdGEgPSAkZmlsdGVyKCdKU09OMnZDYXJkJykoc2VsZi5wcm9wcyk7XG5cblx0XHRcdFx0Ly8gUmV2YWxpZGF0ZSBhbGwgcHJvcHNcblx0XHRcdFx0Xy5lYWNoKHNlbGYuZmFpbGVkUHJvcHMsIGZ1bmN0aW9uKG5hbWUsIGluZGV4KSB7XG5cdFx0XHRcdFx0aWYgKCFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV0pICYmICFfLmlzVW5kZWZpbmVkKHNlbGYucHJvcHNbbmFtZV1bMF0pKSB7XG5cdFx0XHRcdFx0XHQvLyBTZXQgZGF0ZXMgYWdhaW4gdG8gbWFrZSBzdXJlIHRoZXkgYXJlIGluIFJGQy02MzUwIGZvcm1hdFxuXHRcdFx0XHRcdFx0c2VsZi5mYWlsZWRQcm9wcy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHRcdFx0c2VsZi52YWxpZGF0ZShuYW1lLCBzZWxmLnByb3BzW25hbWVdWzBdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9LFxuXG5cdFx0XHRtYXRjaGVzOiBmdW5jdGlvbihwYXR0ZXJuKSB7XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKHBhdHRlcm4pIHx8IHBhdHRlcm4ubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0dmFyIG1vZGVsID0gdGhpcztcblx0XHRcdFx0dmFyIG1hdGNoaW5nUHJvcHMgPSBbJ2ZuJywgJ3RpdGxlJywgJ29yZycsICdlbWFpbCcsICduaWNrbmFtZScsICdub3RlJywgJ3VybCcsICdjbG91ZCcsICdhZHInLCAnaW1wcCcsICd0ZWwnXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BOYW1lKSB7XG5cdFx0XHRcdFx0aWYgKG1vZGVsLnByb3BzW3Byb3BOYW1lXSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG1vZGVsLnByb3BzW3Byb3BOYW1lXS5maWx0ZXIoZnVuY3Rpb24gKHByb3BlcnR5KSB7XG5cdFx0XHRcdFx0XHRcdGlmICghcHJvcGVydHkudmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0aWYgKF8uaXNTdHJpbmcocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHByb3BlcnR5LnZhbHVlLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpICE9PSAtMTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRpZiAoXy5pc0FycmF5KHByb3BlcnR5LnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBwcm9wZXJ0eS52YWx1ZS5maWx0ZXIoZnVuY3Rpb24odikge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHYudG9Mb3dlckNhc2UoKS5pbmRleE9mKHBhdHRlcm4udG9Mb3dlckNhc2UoKSkgIT09IC0xO1xuXHRcdFx0XHRcdFx0XHRcdH0pLmxlbmd0aCA+IDA7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fSkubGVuZ3RoID4gMDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIG1hdGNoaW5nUHJvcHMubGVuZ3RoID4gMDtcblx0XHRcdH0sXG5cblx0XHRcdHZhbGlkYXRlOiBmdW5jdGlvbihwcm9wLCBwcm9wZXJ0eSkge1xuXHRcdFx0XHRzd2l0Y2gocHJvcCkge1xuXHRcdFx0XHRjYXNlICdjYXRlZ29yaWVzJzpcblx0XHRcdFx0XHQvLyBBdm9pZCB1bmVzY2FwZWQgY29tbWFzXG5cdFx0XHRcdFx0aWYgKGFuZ3VsYXIuaXNBcnJheShwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0XHRcdGlmKHByb3BlcnR5LnZhbHVlLmpvaW4oJzsnKS5pbmRleE9mKCcsJykgIT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZmFpbGVkUHJvcHMucHVzaChwcm9wKTtcblx0XHRcdFx0XHRcdFx0cHJvcGVydHkudmFsdWUgPSBwcm9wZXJ0eS52YWx1ZS5qb2luKCcsJykuc3BsaXQoJywnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2UgaWYgKGFuZ3VsYXIuaXNTdHJpbmcocHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRpZihwcm9wZXJ0eS52YWx1ZS5pbmRleE9mKCcsJykgIT09IC0xKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZmFpbGVkUHJvcHMucHVzaChwcm9wKTtcblx0XHRcdFx0XHRcdFx0cHJvcGVydHkudmFsdWUgPSBwcm9wZXJ0eS52YWx1ZS5zcGxpdCgnLCcpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvLyBSZW1vdmUgZHVwbGljYXRlIGNhdGVnb3JpZXNcblx0XHRcdFx0XHR2YXIgdW5pcXVlQ2F0ZWdvcmllcyA9IF8udW5pcXVlKHByb3BlcnR5LnZhbHVlKTtcblx0XHRcdFx0XHRpZighYW5ndWxhci5lcXVhbHModW5pcXVlQ2F0ZWdvcmllcywgcHJvcGVydHkudmFsdWUpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmZhaWxlZFByb3BzLnB1c2gocHJvcCk7XG5cdFx0XHRcdFx0XHRwcm9wZXJ0eS52YWx1ZSA9IHVuaXF1ZUNhdGVnb3JpZXM7XG5cdFx0XHRcdFx0XHQvL2NvbnNvbGUuZGVidWcodGhpcy51aWQoKSsnOiBDYXRlZ29yaWVzIGR1cGxpY2F0ZTogJyArIHByb3BlcnR5LnZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHByb3BlcnR5O1xuXHRcdFx0fVxuXG5cdFx0fSk7XG5cblx0XHRpZihhbmd1bGFyLmlzRGVmaW5lZCh2Q2FyZCkpIHtcblx0XHRcdGFuZ3VsYXIuZXh0ZW5kKHRoaXMuZGF0YSwgdkNhcmQpO1xuXHRcdFx0YW5ndWxhci5leHRlbmQodGhpcy5wcm9wcywgJGZpbHRlcigndkNhcmQySlNPTicpKHRoaXMuZGF0YS5hZGRyZXNzRGF0YSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhbmd1bGFyLmV4dGVuZCh0aGlzLnByb3BzLCB7XG5cdFx0XHRcdHZlcnNpb246IFt7dmFsdWU6ICczLjAnfV0sXG5cdFx0XHRcdGZuOiBbe3ZhbHVlOiAnJ31dXG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuZGF0YS5hZGRyZXNzRGF0YSA9ICRmaWx0ZXIoJ0pTT04ydkNhcmQnKSh0aGlzLnByb3BzKTtcblx0XHR9XG5cblx0XHR2YXIgcHJvcGVydHkgPSB0aGlzLmdldFByb3BlcnR5KCdjYXRlZ29yaWVzJyk7XG5cdFx0aWYoIXByb3BlcnR5KSB7XG5cdFx0XHR0aGlzLmNhdGVnb3JpZXMoW10pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoYW5ndWxhci5pc1N0cmluZyhwcm9wZXJ0eS52YWx1ZSkpIHtcblx0XHRcdFx0dGhpcy5jYXRlZ29yaWVzKFtwcm9wZXJ0eS52YWx1ZV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5mYWN0b3J5KCdBZGRyZXNzQm9va1NlcnZpY2UnLCBmdW5jdGlvbihEYXZDbGllbnQsIERhdlNlcnZpY2UsIFNldHRpbmdzU2VydmljZSwgQWRkcmVzc0Jvb2ssICRxKSB7XG5cblx0dmFyIGFkZHJlc3NCb29rcyA9IFtdO1xuXHR2YXIgbG9hZFByb21pc2UgPSB1bmRlZmluZWQ7XG5cblx0dmFyIGxvYWRBbGwgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoYWRkcmVzc0Jvb2tzLmxlbmd0aCA+IDApIHtcblx0XHRcdHJldHVybiAkcS53aGVuKGFkZHJlc3NCb29rcyk7XG5cdFx0fVxuXHRcdGlmIChfLmlzVW5kZWZpbmVkKGxvYWRQcm9taXNlKSkge1xuXHRcdFx0bG9hZFByb21pc2UgPSBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oYWNjb3VudCkge1xuXHRcdFx0XHRsb2FkUHJvbWlzZSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0YWRkcmVzc0Jvb2tzID0gYWNjb3VudC5hZGRyZXNzQm9va3MubWFwKGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBBZGRyZXNzQm9vayhhZGRyZXNzQm9vayk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiBsb2FkUHJvbWlzZTtcblx0fTtcblxuXHRyZXR1cm4ge1xuXHRcdGdldEFsbDogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gbG9hZEFsbCgpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdHJldHVybiBhZGRyZXNzQm9va3M7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0Z2V0R3JvdXBzOiBmdW5jdGlvbiAoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rcykge1xuXHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2tzLm1hcChmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdFx0XHRcdHJldHVybiBlbGVtZW50Lmdyb3Vwcztcblx0XHRcdFx0fSkucmVkdWNlKGZ1bmN0aW9uKGEsIGIpIHtcblx0XHRcdFx0XHRyZXR1cm4gYS5jb25jYXQoYik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSxcblxuXHRcdGdldERlZmF1bHRBZGRyZXNzQm9vazogZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2tzWzBdO1xuXHRcdH0sXG5cblx0XHRnZXRBZGRyZXNzQm9vazogZnVuY3Rpb24oZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybiBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oYWNjb3VudCkge1xuXHRcdFx0XHRyZXR1cm4gRGF2Q2xpZW50LmdldEFkZHJlc3NCb29rKHtkaXNwbGF5TmFtZTpkaXNwbGF5TmFtZSwgdXJsOmFjY291bnQuaG9tZVVybH0pLnRoZW4oZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRhZGRyZXNzQm9vayA9IG5ldyBBZGRyZXNzQm9vayh7XG5cdFx0XHRcdFx0XHR1cmw6IGFkZHJlc3NCb29rWzBdLmhyZWYsXG5cdFx0XHRcdFx0XHRkYXRhOiBhZGRyZXNzQm9va1swXVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGFkZHJlc3NCb29rLmRpc3BsYXlOYW1lID0gZGlzcGxheU5hbWU7XG5cdFx0XHRcdFx0cmV0dXJuIGFkZHJlc3NCb29rO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRjcmVhdGU6IGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKGFjY291bnQpIHtcblx0XHRcdFx0cmV0dXJuIERhdkNsaWVudC5jcmVhdGVBZGRyZXNzQm9vayh7ZGlzcGxheU5hbWU6ZGlzcGxheU5hbWUsIHVybDphY2NvdW50LmhvbWVVcmx9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRkZWxldGU6IGZ1bmN0aW9uKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRyZXR1cm4gRGF2U2VydmljZS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gRGF2Q2xpZW50LmRlbGV0ZUFkZHJlc3NCb29rKGFkZHJlc3NCb29rKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdHZhciBpbmRleCA9IGFkZHJlc3NCb29rcy5pbmRleE9mKGFkZHJlc3NCb29rKTtcblx0XHRcdFx0XHRhZGRyZXNzQm9va3Muc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0cmVuYW1lOiBmdW5jdGlvbihhZGRyZXNzQm9vaywgZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybiBEYXZTZXJ2aWNlLnRoZW4oZnVuY3Rpb24oYWNjb3VudCkge1xuXHRcdFx0XHRyZXR1cm4gRGF2Q2xpZW50LnJlbmFtZUFkZHJlc3NCb29rKGFkZHJlc3NCb29rLCB7ZGlzcGxheU5hbWU6ZGlzcGxheU5hbWUsIHVybDphY2NvdW50LmhvbWVVcmx9KTtcblx0XHRcdH0pO1xuXHRcdH0sXG5cblx0XHRnZXQ6IGZ1bmN0aW9uKGRpc3BsYXlOYW1lKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRBbGwoKS50aGVuKGZ1bmN0aW9uKGFkZHJlc3NCb29rcykge1xuXHRcdFx0XHRyZXR1cm4gYWRkcmVzc0Jvb2tzLmZpbHRlcihmdW5jdGlvbiAoZWxlbWVudCkge1xuXHRcdFx0XHRcdHJldHVybiBlbGVtZW50LmRpc3BsYXlOYW1lID09PSBkaXNwbGF5TmFtZTtcblx0XHRcdFx0fSlbMF07XG5cdFx0XHR9KTtcblx0XHR9LFxuXG5cdFx0c3luYzogZnVuY3Rpb24oYWRkcmVzc0Jvb2spIHtcblx0XHRcdHJldHVybiBEYXZDbGllbnQuc3luY0FkZHJlc3NCb29rKGFkZHJlc3NCb29rKTtcblx0XHR9LFxuXG5cdFx0c2hhcmU6IGZ1bmN0aW9uKGFkZHJlc3NCb29rLCBzaGFyZVR5cGUsIHNoYXJlV2l0aCwgd3JpdGFibGUsIGV4aXN0aW5nU2hhcmUpIHtcblx0XHRcdHZhciB4bWxEb2MgPSBkb2N1bWVudC5pbXBsZW1lbnRhdGlvbi5jcmVhdGVEb2N1bWVudCgnJywgJycsIG51bGwpO1xuXHRcdFx0dmFyIG9TaGFyZSA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdvOnNoYXJlJyk7XG5cdFx0XHRvU2hhcmUuc2V0QXR0cmlidXRlKCd4bWxuczpkJywgJ0RBVjonKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOm8nLCAnaHR0cDovL293bmNsb3VkLm9yZy9ucycpO1xuXHRcdFx0eG1sRG9jLmFwcGVuZENoaWxkKG9TaGFyZSk7XG5cblx0XHRcdHZhciBvU2V0ID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286c2V0Jyk7XG5cdFx0XHRvU2hhcmUuYXBwZW5kQ2hpbGQob1NldCk7XG5cblx0XHRcdHZhciBkSHJlZiA9IHhtbERvYy5jcmVhdGVFbGVtZW50KCdkOmhyZWYnKTtcblx0XHRcdGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfVVNFUikge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy91c2Vycy8nO1xuXHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0ZEhyZWYudGV4dENvbnRlbnQgPSAncHJpbmNpcGFsOnByaW5jaXBhbHMvZ3JvdXBzLyc7XG5cdFx0XHR9XG5cdFx0XHRkSHJlZi50ZXh0Q29udGVudCArPSBzaGFyZVdpdGg7XG5cdFx0XHRvU2V0LmFwcGVuZENoaWxkKGRIcmVmKTtcblxuXHRcdFx0dmFyIG9TdW1tYXJ5ID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286c3VtbWFyeScpO1xuXHRcdFx0b1N1bW1hcnkudGV4dENvbnRlbnQgPSB0KCdjb250YWN0cycsICd7YWRkcmVzc2Jvb2t9IHNoYXJlZCBieSB7b3duZXJ9Jywge1xuXHRcdFx0XHRhZGRyZXNzYm9vazogYWRkcmVzc0Jvb2suZGlzcGxheU5hbWUsXG5cdFx0XHRcdG93bmVyOiBhZGRyZXNzQm9vay5vd25lclxuXHRcdFx0fSk7XG5cdFx0XHRvU2V0LmFwcGVuZENoaWxkKG9TdW1tYXJ5KTtcblxuXHRcdFx0aWYgKHdyaXRhYmxlKSB7XG5cdFx0XHRcdHZhciBvUlcgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpyZWFkLXdyaXRlJyk7XG5cdFx0XHRcdG9TZXQuYXBwZW5kQ2hpbGQob1JXKTtcblx0XHRcdH1cblxuXHRcdFx0dmFyIGJvZHkgPSBvU2hhcmUub3V0ZXJIVE1MO1xuXG5cdFx0XHRyZXR1cm4gRGF2Q2xpZW50Lnhoci5zZW5kKFxuXHRcdFx0XHRkYXYucmVxdWVzdC5iYXNpYyh7bWV0aG9kOiAnUE9TVCcsIGRhdGE6IGJvZHl9KSxcblx0XHRcdFx0YWRkcmVzc0Jvb2sudXJsXG5cdFx0XHQpLnRoZW4oZnVuY3Rpb24ocmVzcG9uc2UpIHtcblx0XHRcdFx0aWYgKHJlc3BvbnNlLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0aWYgKCFleGlzdGluZ1NoYXJlKSB7XG5cdFx0XHRcdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0XHRcdFx0YWRkcmVzc0Jvb2suc2hhcmVkV2l0aC51c2Vycy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0XHRpZDogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdGRpc3BsYXluYW1lOiBzaGFyZVdpdGgsXG5cdFx0XHRcdFx0XHRcdFx0d3JpdGFibGU6IHdyaXRhYmxlXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmIChzaGFyZVR5cGUgPT09IE9DLlNoYXJlLlNIQVJFX1RZUEVfR1JPVVApIHtcblx0XHRcdFx0XHRcdFx0YWRkcmVzc0Jvb2suc2hhcmVkV2l0aC5ncm91cHMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IHNoYXJlV2l0aCxcblx0XHRcdFx0XHRcdFx0XHRkaXNwbGF5bmFtZTogc2hhcmVXaXRoLFxuXHRcdFx0XHRcdFx0XHRcdHdyaXRhYmxlOiB3cml0YWJsZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fSxcblxuXHRcdHVuc2hhcmU6IGZ1bmN0aW9uKGFkZHJlc3NCb29rLCBzaGFyZVR5cGUsIHNoYXJlV2l0aCkge1xuXHRcdFx0dmFyIHhtbERvYyA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZURvY3VtZW50KCcnLCAnJywgbnVsbCk7XG5cdFx0XHR2YXIgb1NoYXJlID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ286c2hhcmUnKTtcblx0XHRcdG9TaGFyZS5zZXRBdHRyaWJ1dGUoJ3htbG5zOmQnLCAnREFWOicpO1xuXHRcdFx0b1NoYXJlLnNldEF0dHJpYnV0ZSgneG1sbnM6bycsICdodHRwOi8vb3duY2xvdWQub3JnL25zJyk7XG5cdFx0XHR4bWxEb2MuYXBwZW5kQ2hpbGQob1NoYXJlKTtcblxuXHRcdFx0dmFyIG9SZW1vdmUgPSB4bWxEb2MuY3JlYXRlRWxlbWVudCgnbzpyZW1vdmUnKTtcblx0XHRcdG9TaGFyZS5hcHBlbmRDaGlsZChvUmVtb3ZlKTtcblxuXHRcdFx0dmFyIGRIcmVmID0geG1sRG9jLmNyZWF0ZUVsZW1lbnQoJ2Q6aHJlZicpO1xuXHRcdFx0aWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9VU0VSKSB7XG5cdFx0XHRcdGRIcmVmLnRleHRDb250ZW50ID0gJ3ByaW5jaXBhbDpwcmluY2lwYWxzL3VzZXJzLyc7XG5cdFx0XHR9IGVsc2UgaWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCkge1xuXHRcdFx0XHRkSHJlZi50ZXh0Q29udGVudCA9ICdwcmluY2lwYWw6cHJpbmNpcGFscy9ncm91cHMvJztcblx0XHRcdH1cblx0XHRcdGRIcmVmLnRleHRDb250ZW50ICs9IHNoYXJlV2l0aDtcblx0XHRcdG9SZW1vdmUuYXBwZW5kQ2hpbGQoZEhyZWYpO1xuXHRcdFx0dmFyIGJvZHkgPSBvU2hhcmUub3V0ZXJIVE1MO1xuXG5cblx0XHRcdHJldHVybiBEYXZDbGllbnQueGhyLnNlbmQoXG5cdFx0XHRcdGRhdi5yZXF1ZXN0LmJhc2ljKHttZXRob2Q6ICdQT1NUJywgZGF0YTogYm9keX0pLFxuXHRcdFx0XHRhZGRyZXNzQm9vay51cmxcblx0XHRcdCkudGhlbihmdW5jdGlvbihyZXNwb25zZSkge1xuXHRcdFx0XHRpZiAocmVzcG9uc2Uuc3RhdHVzID09PSAyMDApIHtcblx0XHRcdFx0XHRpZiAoc2hhcmVUeXBlID09PSBPQy5TaGFyZS5TSEFSRV9UWVBFX1VTRVIpIHtcblx0XHRcdFx0XHRcdGFkZHJlc3NCb29rLnNoYXJlZFdpdGgudXNlcnMgPSBhZGRyZXNzQm9vay5zaGFyZWRXaXRoLnVzZXJzLmZpbHRlcihmdW5jdGlvbih1c2VyKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB1c2VyLmlkICE9PSBzaGFyZVdpdGg7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHNoYXJlVHlwZSA9PT0gT0MuU2hhcmUuU0hBUkVfVFlQRV9HUk9VUCkge1xuXHRcdFx0XHRcdFx0YWRkcmVzc0Jvb2suc2hhcmVkV2l0aC5ncm91cHMgPSBhZGRyZXNzQm9vay5zaGFyZWRXaXRoLmdyb3Vwcy5maWx0ZXIoZnVuY3Rpb24oZ3JvdXBzKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBncm91cHMuaWQgIT09IHNoYXJlV2l0aDtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHQvL3RvZG8gLSByZW1vdmUgZW50cnkgZnJvbSBhZGRyZXNzYm9vayBvYmplY3Rcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0fVxuXG5cblx0fTtcblxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ0NvbnRhY3RTZXJ2aWNlJywgZnVuY3Rpb24oRGF2Q2xpZW50LCBBZGRyZXNzQm9va1NlcnZpY2UsIENvbnRhY3QsICRxLCBDYWNoZUZhY3RvcnksIHV1aWQ0KSB7XG5cblx0dmFyIGNhY2hlRmlsbGVkID0gZmFsc2U7XG5cblx0dmFyIGNvbnRhY3RzID0gQ2FjaGVGYWN0b3J5KCdjb250YWN0cycpO1xuXG5cdHZhciBvYnNlcnZlckNhbGxiYWNrcyA9IFtdO1xuXG5cdHZhciBsb2FkUHJvbWlzZSA9IHVuZGVmaW5lZDtcblxuXHR0aGlzLnJlZ2lzdGVyT2JzZXJ2ZXJDYWxsYmFjayA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0b2JzZXJ2ZXJDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cdH07XG5cblx0dmFyIG5vdGlmeU9ic2VydmVycyA9IGZ1bmN0aW9uKGV2ZW50TmFtZSwgdWlkKSB7XG5cdFx0dmFyIGV2ID0ge1xuXHRcdFx0ZXZlbnQ6IGV2ZW50TmFtZSxcblx0XHRcdHVpZDogdWlkLFxuXHRcdFx0Y29udGFjdHM6IGNvbnRhY3RzLnZhbHVlcygpXG5cdFx0fTtcblx0XHRhbmd1bGFyLmZvckVhY2gob2JzZXJ2ZXJDYWxsYmFja3MsIGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0XHRjYWxsYmFjayhldik7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5maWxsQ2FjaGUgPSBmdW5jdGlvbigpIHtcblx0XHRpZiAoXy5pc1VuZGVmaW5lZChsb2FkUHJvbWlzZSkpIHtcblx0XHRcdGxvYWRQcm9taXNlID0gQWRkcmVzc0Jvb2tTZXJ2aWNlLmdldEFsbCgpLnRoZW4oZnVuY3Rpb24gKGVuYWJsZWRBZGRyZXNzQm9va3MpIHtcblx0XHRcdFx0dmFyIHByb21pc2VzID0gW107XG5cdFx0XHRcdGVuYWJsZWRBZGRyZXNzQm9va3MuZm9yRWFjaChmdW5jdGlvbiAoYWRkcmVzc0Jvb2spIHtcblx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKFxuXHRcdFx0XHRcdFx0QWRkcmVzc0Jvb2tTZXJ2aWNlLnN5bmMoYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24gKGFkZHJlc3NCb29rKSB7XG5cdFx0XHRcdFx0XHRcdGZvciAodmFyIGkgaW4gYWRkcmVzc0Jvb2sub2JqZWN0cykge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChhZGRyZXNzQm9vay5vYmplY3RzW2ldLmFkZHJlc3NEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2YXIgY29udGFjdCA9IG5ldyBDb250YWN0KGFkZHJlc3NCb29rLCBhZGRyZXNzQm9vay5vYmplY3RzW2ldKTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRhY3RzLnB1dChjb250YWN0LnVpZCgpLCBjb250YWN0KTtcblx0XHRcdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gY3VzdG9tIGNvbnNvbGVcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdJbnZhbGlkIGNvbnRhY3QgcmVjZWl2ZWQ6ICcgKyBhZGRyZXNzQm9vay5vYmplY3RzW2ldLnVybCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gJHEuYWxsKHByb21pc2VzKS50aGVuKGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0XHRjYWNoZUZpbGxlZCA9IHRydWU7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiBsb2FkUHJvbWlzZTtcblx0fTtcblxuXHR0aGlzLmdldEFsbCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmKGNhY2hlRmlsbGVkID09PSBmYWxzZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmlsbENhY2hlKCkudGhlbihmdW5jdGlvbigpIHtcblx0XHRcdFx0cmV0dXJuIGNvbnRhY3RzLnZhbHVlcygpO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAkcS53aGVuKGNvbnRhY3RzLnZhbHVlcygpKTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5nZXRHcm91cHMgPSBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0QWxsKCkudGhlbihmdW5jdGlvbihjb250YWN0cykge1xuXHRcdFx0cmV0dXJuIF8udW5pcShjb250YWN0cy5tYXAoZnVuY3Rpb24gKGVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnQuY2F0ZWdvcmllcygpO1xuXHRcdFx0fSkucmVkdWNlKGZ1bmN0aW9uKGEsIGIpIHtcblx0XHRcdFx0cmV0dXJuIGEuY29uY2F0KGIpO1xuXHRcdFx0fSwgW10pLnNvcnQoKSwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH07XG5cblx0dGhpcy5nZXRCeUlkID0gZnVuY3Rpb24odWlkKSB7XG5cdFx0aWYoY2FjaGVGaWxsZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5maWxsQ2FjaGUoKS50aGVuKGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRyZXR1cm4gY29udGFjdHMuZ2V0KHVpZCk7XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuICRxLndoZW4oY29udGFjdHMuZ2V0KHVpZCkpO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLmNyZWF0ZSA9IGZ1bmN0aW9uKG5ld0NvbnRhY3QsIGFkZHJlc3NCb29rLCB1aWQpIHtcblx0XHRhZGRyZXNzQm9vayA9IGFkZHJlc3NCb29rIHx8IEFkZHJlc3NCb29rU2VydmljZS5nZXREZWZhdWx0QWRkcmVzc0Jvb2soKTtcblx0XHRuZXdDb250YWN0ID0gbmV3Q29udGFjdCB8fCBuZXcgQ29udGFjdChhZGRyZXNzQm9vayk7XG5cdFx0dmFyIG5ld1VpZCA9ICcnO1xuXHRcdGlmKHV1aWQ0LnZhbGlkYXRlKHVpZCkpIHtcblx0XHRcdG5ld1VpZCA9IHVpZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bmV3VWlkID0gdXVpZDQuZ2VuZXJhdGUoKTtcblx0XHR9XG5cdFx0bmV3Q29udGFjdC51aWQobmV3VWlkKTtcblx0XHRuZXdDb250YWN0LnNldFVybChhZGRyZXNzQm9vaywgbmV3VWlkKTtcblx0XHRuZXdDb250YWN0LmFkZHJlc3NCb29rSWQgPSBhZGRyZXNzQm9vay5kaXNwbGF5TmFtZTtcblx0XHRpZiAoXy5pc1VuZGVmaW5lZChuZXdDb250YWN0LmZ1bGxOYW1lKCkpIHx8IG5ld0NvbnRhY3QuZnVsbE5hbWUoKSA9PT0gJycpIHtcblx0XHRcdG5ld0NvbnRhY3QuZnVsbE5hbWUodCgnY29udGFjdHMnLCAnTmV3IGNvbnRhY3QnKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIERhdkNsaWVudC5jcmVhdGVDYXJkKFxuXHRcdFx0YWRkcmVzc0Jvb2ssXG5cdFx0XHR7XG5cdFx0XHRcdGRhdGE6IG5ld0NvbnRhY3QuZGF0YS5hZGRyZXNzRGF0YSxcblx0XHRcdFx0ZmlsZW5hbWU6IG5ld1VpZCArICcudmNmJ1xuXHRcdFx0fVxuXHRcdCkudGhlbihmdW5jdGlvbih4aHIpIHtcblx0XHRcdG5ld0NvbnRhY3Quc2V0RVRhZyh4aHIuZ2V0UmVzcG9uc2VIZWFkZXIoJ0VUYWcnKSk7XG5cdFx0XHRjb250YWN0cy5wdXQobmV3VWlkLCBuZXdDb250YWN0KTtcblx0XHRcdG5vdGlmeU9ic2VydmVycygnY3JlYXRlJywgbmV3VWlkKTtcblx0XHRcdCQoJyNkZXRhaWxzLWZ1bGxOYW1lJykuc2VsZWN0KCk7XG5cdFx0XHRyZXR1cm4gbmV3Q29udGFjdDtcblx0XHR9KS5jYXRjaChmdW5jdGlvbigpIHtcblx0XHRcdE9DLk5vdGlmaWNhdGlvbi5zaG93VGVtcG9yYXJ5KHQoJ2NvbnRhY3RzJywgJ0NvbnRhY3QgY291bGQgbm90IGJlIGNyZWF0ZWQuJykpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHRoaXMuaW1wb3J0ID0gZnVuY3Rpb24oZGF0YSwgdHlwZSwgYWRkcmVzc0Jvb2ssIHByb2dyZXNzQ2FsbGJhY2spIHtcblx0XHRhZGRyZXNzQm9vayA9IGFkZHJlc3NCb29rIHx8IEFkZHJlc3NCb29rU2VydmljZS5nZXREZWZhdWx0QWRkcmVzc0Jvb2soKTtcblxuXHRcdHZhciByZWdleHAgPSAvQkVHSU46VkNBUkRbXFxzXFxTXSo/RU5EOlZDQVJEL21naTtcblx0XHR2YXIgc2luZ2xlVkNhcmRzID0gZGF0YS5tYXRjaChyZWdleHApO1xuXG5cdFx0aWYgKCFzaW5nbGVWQ2FyZHMpIHtcblx0XHRcdE9DLk5vdGlmaWNhdGlvbi5zaG93VGVtcG9yYXJ5KHQoJ2NvbnRhY3RzJywgJ05vIGNvbnRhY3RzIGluIGZpbGUuIE9ubHkgVkNhcmQgZmlsZXMgYXJlIGFsbG93ZWQuJykpO1xuXHRcdFx0aWYgKHByb2dyZXNzQ2FsbGJhY2spIHtcblx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjaygxKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dmFyIG51bSA9IDE7XG5cdFx0Zm9yKHZhciBpIGluIHNpbmdsZVZDYXJkcykge1xuXHRcdFx0dmFyIG5ld0NvbnRhY3QgPSBuZXcgQ29udGFjdChhZGRyZXNzQm9vaywge2FkZHJlc3NEYXRhOiBzaW5nbGVWQ2FyZHNbaV19KTtcblx0XHRcdGlmIChbJzMuMCcsICc0LjAnXS5pbmRleE9mKG5ld0NvbnRhY3QudmVyc2lvbigpKSA8IDApIHtcblx0XHRcdFx0aWYgKHByb2dyZXNzQ2FsbGJhY2spIHtcblx0XHRcdFx0XHRwcm9ncmVzc0NhbGxiYWNrKG51bSAvIHNpbmdsZVZDYXJkcy5sZW5ndGgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdE9DLk5vdGlmaWNhdGlvbi5zaG93VGVtcG9yYXJ5KHQoJ2NvbnRhY3RzJywgJ09ubHkgVkNhcmQgdmVyc2lvbiA0LjAgKFJGQzYzNTApIG9yIHZlcnNpb24gMy4wIChSRkMyNDI2KSBhcmUgc3VwcG9ydGVkLicpKTtcblx0XHRcdFx0bnVtKys7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5jcmVhdGUobmV3Q29udGFjdCwgYWRkcmVzc0Jvb2spLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRcdC8vIFVwZGF0ZSB0aGUgcHJvZ3Jlc3MgaW5kaWNhdG9yXG5cdFx0XHRcdGlmIChwcm9ncmVzc0NhbGxiYWNrKSB7XG5cdFx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhudW0gLyBzaW5nbGVWQ2FyZHMubGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRudW0rKztcblx0XHRcdH0pO1xuXHRcdH1cblx0fTtcblxuXHR0aGlzLm1vdmVDb250YWN0ID0gZnVuY3Rpb24gKGNvbnRhY3QsIGFkZHJlc3Nib29rKSB7XG5cdFx0aWYgKGNvbnRhY3QuYWRkcmVzc0Jvb2tJZCA9PT0gYWRkcmVzc2Jvb2suZGlzcGxheU5hbWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udGFjdC5zeW5jVkNhcmQoKTtcblx0XHR2YXIgY2xvbmUgPSBhbmd1bGFyLmNvcHkoY29udGFjdCk7XG5cdFx0dmFyIHVpZCA9IGNvbnRhY3QudWlkKCk7XG5cblx0XHQvLyBkZWxldGUgdGhlIG9sZCBvbmUgYmVmb3JlIHRvIGF2b2lkIGNvbmZsaWN0XG5cdFx0dGhpcy5kZWxldGUoY29udGFjdCk7XG5cblx0XHQvLyBjcmVhdGUgdGhlIGNvbnRhY3QgaW4gdGhlIG5ldyB0YXJnZXQgYWRkcmVzc2Jvb2tcblx0XHR0aGlzLmNyZWF0ZShjbG9uZSwgYWRkcmVzc2Jvb2ssIHVpZCk7XG5cdH07XG5cblx0dGhpcy51cGRhdGUgPSBmdW5jdGlvbihjb250YWN0KSB7XG5cdFx0Ly8gdXBkYXRlIHJldiBmaWVsZFxuXHRcdGNvbnRhY3Quc3luY1ZDYXJkKCk7XG5cblx0XHQvLyB1cGRhdGUgY29udGFjdCBvbiBzZXJ2ZXJcblx0XHRyZXR1cm4gRGF2Q2xpZW50LnVwZGF0ZUNhcmQoY29udGFjdC5kYXRhLCB7anNvbjogdHJ1ZX0pLnRoZW4oZnVuY3Rpb24oeGhyKSB7XG5cdFx0XHR2YXIgbmV3RXRhZyA9IHhoci5nZXRSZXNwb25zZUhlYWRlcignRVRhZycpO1xuXHRcdFx0Y29udGFjdC5zZXRFVGFnKG5ld0V0YWcpO1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCd1cGRhdGUnLCBjb250YWN0LnVpZCgpKTtcblx0XHR9KTtcblx0fTtcblxuXHR0aGlzLmRlbGV0ZSA9IGZ1bmN0aW9uKGNvbnRhY3QpIHtcblx0XHQvLyBkZWxldGUgY29udGFjdCBmcm9tIHNlcnZlclxuXHRcdHJldHVybiBEYXZDbGllbnQuZGVsZXRlQ2FyZChjb250YWN0LmRhdGEpLnRoZW4oZnVuY3Rpb24oKSB7XG5cdFx0XHRjb250YWN0cy5yZW1vdmUoY29udGFjdC51aWQoKSk7XG5cdFx0XHRub3RpZnlPYnNlcnZlcnMoJ2RlbGV0ZScsIGNvbnRhY3QudWlkKCkpO1xuXHRcdH0pO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ0RhdkNsaWVudCcsIGZ1bmN0aW9uKCkge1xuXHR2YXIgeGhyID0gbmV3IGRhdi50cmFuc3BvcnQuQmFzaWMoXG5cdFx0bmV3IGRhdi5DcmVkZW50aWFscygpXG5cdCk7XG5cdHJldHVybiBuZXcgZGF2LkNsaWVudCh4aHIpO1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ0RhdlNlcnZpY2UnLCBmdW5jdGlvbihEYXZDbGllbnQpIHtcblx0cmV0dXJuIERhdkNsaWVudC5jcmVhdGVBY2NvdW50KHtcblx0XHRzZXJ2ZXI6IE9DLmxpbmtUb1JlbW90ZSgnZGF2L2FkZHJlc3Nib29rcycpLFxuXHRcdGFjY291bnRUeXBlOiAnY2FyZGRhdicsXG5cdFx0dXNlUHJvdmlkZWRQYXRoOiB0cnVlXG5cdH0pO1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ1NlYXJjaFNlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0dmFyIHNlYXJjaFRlcm0gPSAnJztcblxuXHR2YXIgb2JzZXJ2ZXJDYWxsYmFja3MgPSBbXTtcblxuXHR0aGlzLnJlZ2lzdGVyT2JzZXJ2ZXJDYWxsYmFjayA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG5cdFx0b2JzZXJ2ZXJDYWxsYmFja3MucHVzaChjYWxsYmFjayk7XG5cdH07XG5cblx0dmFyIG5vdGlmeU9ic2VydmVycyA9IGZ1bmN0aW9uKGV2ZW50TmFtZSkge1xuXHRcdHZhciBldiA9IHtcblx0XHRcdGV2ZW50OmV2ZW50TmFtZSxcblx0XHRcdHNlYXJjaFRlcm06c2VhcmNoVGVybVxuXHRcdH07XG5cdFx0YW5ndWxhci5mb3JFYWNoKG9ic2VydmVyQ2FsbGJhY2tzLCBmdW5jdGlvbihjYWxsYmFjaykge1xuXHRcdFx0Y2FsbGJhY2soZXYpO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHZhciBTZWFyY2hQcm94eSA9IHtcblx0XHRhdHRhY2g6IGZ1bmN0aW9uKHNlYXJjaCkge1xuXHRcdFx0c2VhcmNoLnNldEZpbHRlcignY29udGFjdHMnLCB0aGlzLmZpbHRlclByb3h5KTtcblx0XHR9LFxuXHRcdGZpbHRlclByb3h5OiBmdW5jdGlvbihxdWVyeSkge1xuXHRcdFx0c2VhcmNoVGVybSA9IHF1ZXJ5O1xuXHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdjaGFuZ2VTZWFyY2gnKTtcblx0XHR9XG5cdH07XG5cblx0dGhpcy5nZXRTZWFyY2hUZXJtID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHNlYXJjaFRlcm07XG5cdH07XG5cblx0dGhpcy5jbGVhblNlYXJjaCA9IGZ1bmN0aW9uKCkge1xuXHRcdGlmICghXy5pc1VuZGVmaW5lZCgkKCcuc2VhcmNoYm94JykpKSB7XG5cdFx0XHQkKCcuc2VhcmNoYm94JylbMF0ucmVzZXQoKTtcblx0XHR9XG5cdFx0c2VhcmNoVGVybSA9ICcnO1xuXHR9O1xuXG5cdGlmICghXy5pc1VuZGVmaW5lZChPQy5QbHVnaW5zKSkge1xuXHRcdE9DLlBsdWdpbnMucmVnaXN0ZXIoJ09DQS5TZWFyY2gnLCBTZWFyY2hQcm94eSk7XG5cdFx0aWYgKCFfLmlzVW5kZWZpbmVkKE9DQS5TZWFyY2gpKSB7XG5cdFx0XHRPQy5TZWFyY2ggPSBuZXcgT0NBLlNlYXJjaCgkKCcjc2VhcmNoYm94JyksICQoJyNzZWFyY2hyZXN1bHRzJykpO1xuXHRcdFx0JCgnI3NlYXJjaGJveCcpLnNob3coKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoIV8uaXNVbmRlZmluZWQoJCgnLnNlYXJjaGJveCcpKSkge1xuXHRcdCQoJy5zZWFyY2hib3gnKVswXS5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIGZ1bmN0aW9uKGUpIHtcblx0XHRcdGlmKGUua2V5Q29kZSA9PT0gMTMpIHtcblx0XHRcdFx0bm90aWZ5T2JzZXJ2ZXJzKCdzdWJtaXRTZWFyY2gnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ1NldHRpbmdzU2VydmljZScsIGZ1bmN0aW9uKCkge1xuXHR2YXIgc2V0dGluZ3MgPSB7XG5cdFx0YWRkcmVzc0Jvb2tzOiBbXG5cdFx0XHQndGVzdEFkZHInXG5cdFx0XVxuXHR9O1xuXG5cdHRoaXMuc2V0ID0gZnVuY3Rpb24oa2V5LCB2YWx1ZSkge1xuXHRcdHNldHRpbmdzW2tleV0gPSB2YWx1ZTtcblx0fTtcblxuXHR0aGlzLmdldCA9IGZ1bmN0aW9uKGtleSkge1xuXHRcdHJldHVybiBzZXR0aW5nc1trZXldO1xuXHR9O1xuXG5cdHRoaXMuZ2V0QWxsID0gZnVuY3Rpb24oKSB7XG5cdFx0cmV0dXJuIHNldHRpbmdzO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLnNlcnZpY2UoJ3ZDYXJkUHJvcGVydGllc1NlcnZpY2UnLCBmdW5jdGlvbigpIHtcblx0LyoqXG5cdCAqIG1hcCB2Q2FyZCBhdHRyaWJ1dGVzIHRvIGludGVybmFsIGF0dHJpYnV0ZXNcblx0ICpcblx0ICogcHJvcE5hbWU6IHtcblx0ICogXHRcdG11bHRpcGxlOiBbQm9vbGVhbl0sIC8vIGlzIHRoaXMgcHJvcCBhbGxvd2VkIG1vcmUgdGhhbiBvbmNlPyAoZGVmYXVsdCA9IGZhbHNlKVxuXHQgKiBcdFx0cmVhZGFibGVOYW1lOiBbU3RyaW5nXSwgLy8gaW50ZXJuYXRpb25hbGl6ZWQgcmVhZGFibGUgbmFtZSBvZiBwcm9wXG5cdCAqIFx0XHR0ZW1wbGF0ZTogW1N0cmluZ10sIC8vIHRlbXBsYXRlIG5hbWUgZm91bmQgaW4gL3RlbXBsYXRlcy9kZXRhaWxJdGVtc1xuXHQgKiBcdFx0Wy4uLl0gLy8gb3B0aW9uYWwgYWRkaXRpb25hbCBpbmZvcm1hdGlvbiB3aGljaCBtaWdodCBnZXQgdXNlZCBieSB0aGUgdGVtcGxhdGVcblx0ICogfVxuXHQgKi9cblx0dGhpcy52Q2FyZE1ldGEgPSB7XG5cdFx0bmlja25hbWU6IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnTmlja25hbWUnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCdcblx0XHR9LFxuXHRcdG46IHtcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRGV0YWlsZWQgbmFtZScpLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJywgJycsICcnLCAnJywgJyddXG5cdFx0XHR9LFxuXHRcdFx0dGVtcGxhdGU6ICduJ1xuXHRcdH0sXG5cdFx0bm90ZToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdOb3RlcycpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0YXJlYSdcblx0XHR9LFxuXHRcdHVybDoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dlYnNpdGUnKSxcblx0XHRcdHRlbXBsYXRlOiAndXJsJ1xuXHRcdH0sXG5cdFx0Y2xvdWQ6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdGZWRlcmF0ZWQgQ2xvdWQgSUQnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6WycnXSxcblx0XHRcdFx0bWV0YTp7dHlwZTpbJ0hPTUUnXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0hPTUUnLCBuYW1lOiB0KCdjb250YWN0cycsICdIb21lJyl9LFxuXHRcdFx0XHR7aWQ6ICdXT1JLJywgbmFtZTogdCgnY29udGFjdHMnLCAnV29yaycpfSxcblx0XHRcdFx0e2lkOiAnT1RIRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdPdGhlcicpfVxuXHRcdFx0XVx0XHR9LFxuXHRcdGFkcjoge1xuXHRcdFx0bXVsdGlwbGU6IHRydWUsXG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0FkZHJlc3MnKSxcblx0XHRcdHRlbXBsYXRlOiAnYWRyJyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJycsICcnLCAnJywgJycsICcnLCAnJywgJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHRjYXRlZ29yaWVzOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0dyb3VwcycpLFxuXHRcdFx0dGVtcGxhdGU6ICdncm91cHMnXG5cdFx0fSxcblx0XHRiZGF5OiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0JpcnRoZGF5JyksXG5cdFx0XHR0ZW1wbGF0ZTogJ2RhdGUnXG5cdFx0fSxcblx0XHRhbm5pdmVyc2FyeToge1xuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdBbm5pdmVyc2FyeScpLFxuXHRcdFx0dGVtcGxhdGU6ICdkYXRlJ1xuXHRcdH0sXG5cdFx0ZGVhdGhkYXRlOiB7XG5cdFx0XHRyZWFkYWJsZU5hbWU6IHQoJ2NvbnRhY3RzJywgJ0RhdGUgb2YgZGVhdGgnKSxcblx0XHRcdHRlbXBsYXRlOiAnZGF0ZSdcblx0XHR9LFxuXHRcdGVtYWlsOiB7XG5cdFx0XHRtdWx0aXBsZTogdHJ1ZSxcblx0XHRcdHJlYWRhYmxlTmFtZTogdCgnY29udGFjdHMnLCAnRW1haWwnKSxcblx0XHRcdHRlbXBsYXRlOiAndGV4dCcsXG5cdFx0XHRkZWZhdWx0VmFsdWU6IHtcblx0XHRcdFx0dmFsdWU6JycsXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSycsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ09USEVSJywgbmFtZTogdCgnY29udGFjdHMnLCAnT3RoZXInKX1cblx0XHRcdF1cblx0XHR9LFxuXHRcdGltcHA6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdJbnN0YW50IG1lc3NhZ2luZycpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnSE9NRSddfVxuXHRcdFx0fSxcblx0XHRcdG9wdGlvbnM6IFtcblx0XHRcdFx0e2lkOiAnSE9NRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0hvbWUnKX0sXG5cdFx0XHRcdHtpZDogJ1dPUksnLCBuYW1lOiB0KCdjb250YWN0cycsICdXb3JrJyl9LFxuXHRcdFx0XHR7aWQ6ICdPVEhFUicsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ090aGVyJyl9XG5cdFx0XHRdXG5cdFx0fSxcblx0XHR0ZWw6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdQaG9uZScpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZWwnLFxuXHRcdFx0ZGVmYXVsdFZhbHVlOiB7XG5cdFx0XHRcdHZhbHVlOlsnJ10sXG5cdFx0XHRcdG1ldGE6e3R5cGU6WydIT01FLFZPSUNFJ119XG5cdFx0XHR9LFxuXHRcdFx0b3B0aW9uczogW1xuXHRcdFx0XHR7aWQ6ICdIT01FLFZPSUNFJywgbmFtZTogdCgnY29udGFjdHMnLCAnSG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSyxWT0lDRScsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ1dvcmsnKX0sXG5cdFx0XHRcdHtpZDogJ0NFTEwnLCBuYW1lOiB0KCdjb250YWN0cycsICdNb2JpbGUnKX0sXG5cdFx0XHRcdHtpZDogJ0ZBWCcsIG5hbWU6IHQoJ2NvbnRhY3RzJywgJ0ZheCcpfSxcblx0XHRcdFx0e2lkOiAnSE9NRSxGQVgnLCBuYW1lOiB0KCdjb250YWN0cycsICdGYXggaG9tZScpfSxcblx0XHRcdFx0e2lkOiAnV09SSyxGQVgnLCBuYW1lOiB0KCdjb250YWN0cycsICdGYXggd29yaycpfSxcblx0XHRcdFx0e2lkOiAnUEFHRVInLCBuYW1lOiB0KCdjb250YWN0cycsICdQYWdlcicpfSxcblx0XHRcdFx0e2lkOiAnVk9JQ0UnLCBuYW1lOiB0KCdjb250YWN0cycsICdWb2ljZScpfVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0J1gtU09DSUFMUFJPRklMRSc6IHtcblx0XHRcdG11bHRpcGxlOiB0cnVlLFxuXHRcdFx0cmVhZGFibGVOYW1lOiB0KCdjb250YWN0cycsICdTb2NpYWwgbmV0d29yaycpLFxuXHRcdFx0dGVtcGxhdGU6ICd0ZXh0Jyxcblx0XHRcdGRlZmF1bHRWYWx1ZToge1xuXHRcdFx0XHR2YWx1ZTpbJyddLFxuXHRcdFx0XHRtZXRhOnt0eXBlOlsnZmFjZWJvb2snXX1cblx0XHRcdH0sXG5cdFx0XHRvcHRpb25zOiBbXG5cdFx0XHRcdHtpZDogJ0ZBQ0VCT09LJywgbmFtZTogJ0ZhY2Vib29rJ30sXG5cdFx0XHRcdHtpZDogJ1RXSVRURVInLCBuYW1lOiAnVHdpdHRlcid9XG5cdFx0XHRdXG5cblx0XHR9XG5cdH07XG5cblx0dGhpcy5maWVsZE9yZGVyID0gW1xuXHRcdCdvcmcnLFxuXHRcdCd0aXRsZScsXG5cdFx0J3RlbCcsXG5cdFx0J2VtYWlsJyxcblx0XHQnYWRyJyxcblx0XHQnaW1wcCcsXG5cdFx0J25pY2snLFxuXHRcdCdiZGF5Jyxcblx0XHQnYW5uaXZlcnNhcnknLFxuXHRcdCdkZWF0aGRhdGUnLFxuXHRcdCd1cmwnLFxuXHRcdCdYLVNPQ0lBTFBST0ZJTEUnLFxuXHRcdCdub3RlJyxcblx0XHQnY2F0ZWdvcmllcycsXG5cdFx0J3JvbGUnXG5cdF07XG5cblx0dGhpcy5maWVsZERlZmluaXRpb25zID0gW107XG5cdGZvciAodmFyIHByb3AgaW4gdGhpcy52Q2FyZE1ldGEpIHtcblx0XHR0aGlzLmZpZWxkRGVmaW5pdGlvbnMucHVzaCh7aWQ6IHByb3AsIG5hbWU6IHRoaXMudkNhcmRNZXRhW3Byb3BdLnJlYWRhYmxlTmFtZSwgbXVsdGlwbGU6ICEhdGhpcy52Q2FyZE1ldGFbcHJvcF0ubXVsdGlwbGV9KTtcblx0fVxuXG5cdHRoaXMuZmFsbGJhY2tNZXRhID0gZnVuY3Rpb24ocHJvcGVydHkpIHtcblx0XHRmdW5jdGlvbiBjYXBpdGFsaXplKHN0cmluZykgeyByZXR1cm4gc3RyaW5nLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgc3RyaW5nLnNsaWNlKDEpOyB9XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5hbWU6ICd1bmtub3duLScgKyBwcm9wZXJ0eSxcblx0XHRcdHJlYWRhYmxlTmFtZTogY2FwaXRhbGl6ZShwcm9wZXJ0eSksXG5cdFx0XHR0ZW1wbGF0ZTogJ2hpZGRlbicsXG5cdFx0XHRuZWNlc3NpdHk6ICdvcHRpb25hbCdcblx0XHR9O1xuXHR9O1xuXG5cdHRoaXMuZ2V0TWV0YSA9IGZ1bmN0aW9uKHByb3BlcnR5KSB7XG5cdFx0cmV0dXJuIHRoaXMudkNhcmRNZXRhW3Byb3BlcnR5XSB8fCB0aGlzLmZhbGxiYWNrTWV0YShwcm9wZXJ0eSk7XG5cdH07XG5cbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ0pTT04ydkNhcmQnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIHZDYXJkLmdlbmVyYXRlKGlucHV0KTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2NvbnRhY3RDb2xvcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHQvLyBDaGVjayBpZiBjb3JlIGhhcyB0aGUgbmV3IGNvbG9yIGdlbmVyYXRvclxuXHRcdGlmKHR5cGVvZiBpbnB1dC50b0hzbCA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0dmFyIGhzbCA9IGlucHV0LnRvSHNsKCk7XG5cdFx0XHRyZXR1cm4gJ2hzbCgnK2hzbFswXSsnLCAnK2hzbFsxXSsnJSwgJytoc2xbMl0rJyUpJztcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gSWYgbm90LCB3ZSB1c2UgdGhlIG9sZCBvbmVcblx0XHRcdC8qIGdsb2JhbCBtZDUgKi9cblx0XHRcdHZhciBoYXNoID0gbWQ1KGlucHV0KS5zdWJzdHJpbmcoMCwgNCksXG5cdFx0XHRcdG1heFJhbmdlID0gcGFyc2VJbnQoJ2ZmZmYnLCAxNiksXG5cdFx0XHRcdGh1ZSA9IHBhcnNlSW50KGhhc2gsIDE2KSAvIG1heFJhbmdlICogMjU2O1xuXHRcdFx0cmV0dXJuICdoc2woJyArIGh1ZSArICcsIDkwJSwgNjUlKSc7XG5cdFx0fVxuXHR9O1xufSk7IiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ2NvbnRhY3RHcm91cEZpbHRlcicsIGZ1bmN0aW9uKCkge1xuXHQndXNlIHN0cmljdCc7XG5cdHJldHVybiBmdW5jdGlvbiAoY29udGFjdHMsIGdyb3VwKSB7XG5cdFx0aWYgKHR5cGVvZiBjb250YWN0cyA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBjb250YWN0cztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBncm91cCA9PT0gJ3VuZGVmaW5lZCcgfHwgZ3JvdXAudG9Mb3dlckNhc2UoKSA9PT0gdCgnY29udGFjdHMnLCAnQWxsIGNvbnRhY3RzJykudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0cmV0dXJuIGNvbnRhY3RzO1xuXHRcdH1cblx0XHR2YXIgZmlsdGVyID0gW107XG5cdFx0aWYgKGNvbnRhY3RzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAodmFyIGkgPSAwOyBpIDwgY29udGFjdHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGdyb3VwLnRvTG93ZXJDYXNlKCkgPT09IHQoJ2NvbnRhY3RzJywgJ05vdCBncm91cGVkJykudG9Mb3dlckNhc2UoKSkge1xuXHRcdFx0XHRcdGlmIChjb250YWN0c1tpXS5jYXRlZ29yaWVzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRmaWx0ZXIucHVzaChjb250YWN0c1tpXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmIChjb250YWN0c1tpXS5jYXRlZ29yaWVzKCkuaW5kZXhPZihncm91cCkgPj0gMCkge1xuXHRcdFx0XHRcdFx0ZmlsdGVyLnB1c2goY29udGFjdHNbaV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmlsdGVyO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignZmllbGRGaWx0ZXInLCBmdW5jdGlvbigpIHtcblx0J3VzZSBzdHJpY3QnO1xuXHRyZXR1cm4gZnVuY3Rpb24gKGZpZWxkcywgY29udGFjdCkge1xuXHRcdGlmICh0eXBlb2YgZmllbGRzID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGZpZWxkcztcblx0XHR9XG5cdFx0aWYgKHR5cGVvZiBjb250YWN0ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuIGZpZWxkcztcblx0XHR9XG5cdFx0dmFyIGZpbHRlciA9IFtdO1xuXHRcdGlmIChmaWVsZHMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKGZpZWxkc1tpXS5tdWx0aXBsZSApIHtcblx0XHRcdFx0XHRmaWx0ZXIucHVzaChmaWVsZHNbaV0pO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChfLmlzVW5kZWZpbmVkKGNvbnRhY3QuZ2V0UHJvcGVydHkoZmllbGRzW2ldLmlkKSkpIHtcblx0XHRcdFx0XHRmaWx0ZXIucHVzaChmaWVsZHNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXI7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCdmaXJzdENoYXJhY3RlcicsIGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcblx0XHRyZXR1cm4gaW5wdXQuY2hhckF0KDApO1xuXHR9O1xufSk7XG4iLCJhbmd1bGFyLm1vZHVsZSgnY29udGFjdHNBcHAnKVxuLmZpbHRlcignbG9jYWxlT3JkZXJCeScsIFtmdW5jdGlvbiAoKSB7XG5cdHJldHVybiBmdW5jdGlvbiAoYXJyYXksIHNvcnRQcmVkaWNhdGUsIHJldmVyc2VPcmRlcikge1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShhcnJheSkpIHJldHVybiBhcnJheTtcblx0XHRpZiAoIXNvcnRQcmVkaWNhdGUpIHJldHVybiBhcnJheTtcblxuXHRcdHZhciBhcnJheUNvcHkgPSBbXTtcblx0XHRhbmd1bGFyLmZvckVhY2goYXJyYXksIGZ1bmN0aW9uIChpdGVtKSB7XG5cdFx0XHRhcnJheUNvcHkucHVzaChpdGVtKTtcblx0XHR9KTtcblxuXHRcdGFycmF5Q29weS5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHR2YXIgdmFsdWVBID0gYVtzb3J0UHJlZGljYXRlXTtcblx0XHRcdGlmIChhbmd1bGFyLmlzRnVuY3Rpb24odmFsdWVBKSkge1xuXHRcdFx0XHR2YWx1ZUEgPSBhW3NvcnRQcmVkaWNhdGVdKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgdmFsdWVCID0gYltzb3J0UHJlZGljYXRlXTtcblx0XHRcdGlmIChhbmd1bGFyLmlzRnVuY3Rpb24odmFsdWVCKSkge1xuXHRcdFx0XHR2YWx1ZUIgPSBiW3NvcnRQcmVkaWNhdGVdKCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhbmd1bGFyLmlzU3RyaW5nKHZhbHVlQSkpIHtcblx0XHRcdFx0cmV0dXJuICFyZXZlcnNlT3JkZXIgPyB2YWx1ZUEubG9jYWxlQ29tcGFyZSh2YWx1ZUIpIDogdmFsdWVCLmxvY2FsZUNvbXBhcmUodmFsdWVBKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGFuZ3VsYXIuaXNOdW1iZXIodmFsdWVBKSB8fCB0eXBlb2YgdmFsdWVBID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0cmV0dXJuICFyZXZlcnNlT3JkZXIgPyB2YWx1ZUEgLSB2YWx1ZUIgOiB2YWx1ZUIgLSB2YWx1ZUE7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIGFycmF5Q29weTtcblx0fTtcbn1dKTtcblxuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ25ld0NvbnRhY3QnLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKGlucHV0KSB7XG5cdFx0cmV0dXJuIGlucHV0ICE9PSAnJyA/IGlucHV0IDogdCgnY29udGFjdHMnLCAnTmV3IGNvbnRhY3QnKTtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ29yZGVyRGV0YWlsSXRlbXMnLCBmdW5jdGlvbih2Q2FyZFByb3BlcnRpZXNTZXJ2aWNlKSB7XG5cdCd1c2Ugc3RyaWN0Jztcblx0cmV0dXJuIGZ1bmN0aW9uKGl0ZW1zLCBmaWVsZCwgcmV2ZXJzZSkge1xuXG5cdFx0dmFyIGZpbHRlcmVkID0gW107XG5cdFx0YW5ndWxhci5mb3JFYWNoKGl0ZW1zLCBmdW5jdGlvbihpdGVtKSB7XG5cdFx0XHRmaWx0ZXJlZC5wdXNoKGl0ZW0pO1xuXHRcdH0pO1xuXG5cdFx0dmFyIGZpZWxkT3JkZXIgPSBhbmd1bGFyLmNvcHkodkNhcmRQcm9wZXJ0aWVzU2VydmljZS5maWVsZE9yZGVyKTtcblx0XHQvLyByZXZlcnNlIHRvIG1vdmUgY3VzdG9tIGl0ZW1zIHRvIHRoZSBlbmQgKGluZGV4T2YgPT0gLTEpXG5cdFx0ZmllbGRPcmRlci5yZXZlcnNlKCk7XG5cblx0XHRmaWx0ZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cdFx0XHRpZihmaWVsZE9yZGVyLmluZGV4T2YoYVtmaWVsZF0pIDwgZmllbGRPcmRlci5pbmRleE9mKGJbZmllbGRdKSkge1xuXHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdH1cblx0XHRcdGlmKGZpZWxkT3JkZXIuaW5kZXhPZihhW2ZpZWxkXSkgPiBmaWVsZE9yZGVyLmluZGV4T2YoYltmaWVsZF0pKSB7XG5cdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdH1cblx0XHRcdHJldHVybiAwO1xuXHRcdH0pO1xuXG5cdFx0aWYocmV2ZXJzZSkgZmlsdGVyZWQucmV2ZXJzZSgpO1xuXHRcdHJldHVybiBmaWx0ZXJlZDtcblx0fTtcbn0pO1xuIiwiYW5ndWxhci5tb2R1bGUoJ2NvbnRhY3RzQXBwJylcbi5maWx0ZXIoJ3RvQXJyYXknLCBmdW5jdGlvbigpIHtcblx0cmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuXHRcdGlmICghKG9iaiBpbnN0YW5jZW9mIE9iamVjdCkpIHJldHVybiBvYmo7XG5cdFx0cmV0dXJuIF8ubWFwKG9iaiwgZnVuY3Rpb24odmFsLCBrZXkpIHtcblx0XHRcdHJldHVybiBPYmplY3QuZGVmaW5lUHJvcGVydHkodmFsLCAnJGtleScsIHt2YWx1ZToga2V5fSk7XG5cdFx0fSk7XG5cdH07XG59KTtcbiIsImFuZ3VsYXIubW9kdWxlKCdjb250YWN0c0FwcCcpXG4uZmlsdGVyKCd2Q2FyZDJKU09OJywgZnVuY3Rpb24oKSB7XG5cdHJldHVybiBmdW5jdGlvbihpbnB1dCkge1xuXHRcdHJldHVybiB2Q2FyZC5wYXJzZShpbnB1dCk7XG5cdH07XG59KTtcbiJdfQ==
