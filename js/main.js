/**
 * main.js
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2015, Codrops
 * http://www.codrops.com
 */

var database = firebase.database();


(function() {

	var bodyEl = document.body,
		docElem = window.document.documentElement,
		support = { transitions: Modernizr.csstransitions },
		// transition end event name
		transEndEventNames = { 'WebkitTransition': 'webkitTransitionEnd', 'MozTransition': 'transitionend', 'OTransition': 'oTransitionEnd', 'msTransition': 'MSTransitionEnd', 'transition': 'transitionend' },
		transEndEventName = transEndEventNames[ Modernizr.prefixed( 'transition' ) ],
		onEndTransition = function( el, callback ) {
			var onEndCallbackFn = function( ev ) {
				if( support.transitions ) {
					if( ev.target != this ) return;
					this.removeEventListener( transEndEventName, onEndCallbackFn );
				}
				if( callback && typeof callback === 'function' ) { callback.call(this); }
			};
			if( support.transitions ) {
				el.addEventListener( transEndEventName, onEndCallbackFn );
			}
			else {
				onEndCallbackFn();
			}
		},
		gridEl = document.querySelector('.theGrid'),
		sidebarEl = document.getElementById('theSidebar'),
		gridItemsContainer = gridEl.querySelector('section.grid'),
		contentItemsContainer = gridEl.querySelector('section.content'),
		gridItems = gridItemsContainer.querySelectorAll('.grid__item'),
		contentItems = contentItemsContainer.querySelectorAll('.content__item'),
		closeCtrl = contentItemsContainer.querySelector('.close-button'),
		current = -1,
		lockScroll = false, xscroll, yscroll,
		isAnimating = false,
		menuCtrl = document.getElementById('menu-toggle'),
		menuCloseCtrl = sidebarEl.querySelector('.close-button');

	/**
	 * gets the viewport width and height
	 * based on http://responsejs.com/labs/dimensions/
	 */
	function getViewport( axis ) {
		var client, inner;
		if( axis === 'x' ) {
			client = docElem['clientWidth'];
			inner = window['innerWidth'];
		}
		else if( axis === 'y' ) {
			client = docElem['clientHeight'];
			inner = window['innerHeight'];
		}
		
		return client < inner ? inner : client;
	}
	function scrollX() { return window.pageXOffset || docElem.scrollLeft; }
	function scrollY() { return window.pageYOffset || docElem.scrollTop; }

	function init() {
        getData();
		
		//setTimeout(() => {initEvents()}, 5000);
		setTimeout(initEvents, 1000);
		
		/*Init app analytic*/
		console.log("Display names on the web page");
		//firebase.analytics();
	}
    
    function initEvents0(){
        var bodyEl = document.body,
            docElem = window.document.documentElement,
            support = { transitions: Modernizr.csstransitions },
            // transition end event name
            transEndEventNames = { 'WebkitTransition': 'webkitTransitionEnd', 'MozTransition': 'transitionend', 'OTransition': 'oTransitionEnd', 'msTransition': 'MSTransitionEnd', 'transition': 'transitionend' },
            transEndEventName = transEndEventNames[ Modernizr.prefixed( 'transition' ) ],
            onEndTransition = function( el, callback ) {
                var onEndCallbackFn = function( ev ) {
                    if( support.transitions ) {
                        if( ev.target != this ) return;
                        this.removeEventListener( transEndEventName, onEndCallbackFn );
                    }
                    if( callback && typeof callback === 'function' ) { callback.call(this); }
                };
                if( support.transitions ) {
                    el.addEventListener( transEndEventName, onEndCallbackFn );
                }
                else {
                    onEndCallbackFn();
                }
            },
            gridEl = document.querySelector('.theGrid'),
            sidebarEl = document.getElementById('theSidebar'),
            gridItemsContainer = gridEl.querySelector('section.grid'),
            contentItemsContainer = gridEl.querySelector('section.content'),
            gridItems = gridItemsContainer.querySelectorAll('.grid__item'),
            contentItems = contentItemsContainer.querySelectorAll('.content__item'),
            closeCtrl = contentItemsContainer.querySelector('.close-button'),
            current = -1,
            lockScroll = false, xscroll, yscroll,
            isAnimating = false,
            menuCtrl = document.getElementById('menu-toggle'),
            menuCloseCtrl = sidebarEl.querySelector('.close-button');
    }
    
    /*-- This function will fetch data from DB and that will be the base of the database --*/
    function getData() {
        
        var test = 1;
        
        console.log("Get Names from Firebase");
        
        /*Go through the array of sections*/
        firebase.database().ref('SectionsNames').once('value', function(names) {
            
            names.val().forEach(function(sectionname) {
                if(test == 1){
                    console.log("section : "+sectionname);
                }
                //Go through the library for any specific key
                firebase.database().ref('Sections').child(sectionname).once('value').then( function(child) {
                    
                    //Get poptions nav tag
                    var menuTag = document.getElementById('poptions');
                    
                    //create a simple menu item
                    var menuItem = document.createElement('div');
                    menuItem.className = 'menu__item';
                    menuItem.id = child.val().title; //get the section title
                    
                    //Create the title
                    var menuLink = document.createElement('a');
                    menuLink.className = 'menu__item-link';
                    menuLink.innerHTML = child.val().title;
                    //menuLink.href = child.val().link; //now
                    
                    //Create marque
                    var menuMarquee = document.createElement('div');
                    menuMarquee.className = 'marquee';
                    
                    //Create spans
                    var menuSpans = document.createElement('div');
                    menuSpans.className = 'marquee__inner';
                    menuSpans.innerHTML = '<span>' + child.val().span + '</span>';
                    
                    
                    //For looping
                    /*child.val().spans.forEach(function (snap) {
                        var menuSpan = document.createElement('span');
                        menuSpan.innerHTML = snap;
                        menuSpans.appendChild(menuSpan);
                        console.log(snap);
                    });*/
                    
                    //Desc
                    var subtitle = document.createElement('p');
                    subtitle.innerHTML = child.val().subtitle;
                    
                    //Add sub elements
                    menuMarquee.appendChild(menuSpans);

                    //Projects
                    var projects = child.val().projects;
                    
                    var projectsNames = child.val().projectNames;
                    //console.log(projects);
                    //Create a grid
                   
                    
                    if(projectsNames) { //if(projects){

                        var grid = document.createElement('section');
                        grid.className='grid';
                        console.log('iterate');
                        console.log(projectsNames);
                       
                        
                        for(let projectname in projectsNames)
                        {
                            //console.log("project: "+projectsNames[projectname]);
                            firebase.database().ref('Sections').child(sectionname).child('projects').child(projectsNames[projectname]).once('value').then( function(currentproject) {
                            //console.log("project title: "+currentproject.val().title);
                            
                            var project = currentproject.val();
                                
                              
                            var gridItem = document.createElement('a');
                            gridItem.className='grid__item';
                            gridItem.href = '#';
                            
                            //Header
                            var image = document.createElement('img');
                            image.className='project__image';
                            image.src = project.imagename;
                                
                            var header = document.createElement('h2');
                            header.className='title title--preview';
                            header.innerHTML = project.title;
                            
                            var loader = document.createElement('div');
                            loader.className='loader';
                            
                            var span = document.createElement('span');
                            span.className='category';
                            span.innerHTML = project.keywords;
                            
                            var metadata = document.createElement('div');
                            metadata.className='meta meta--preview';
                            
                            var datedata = document.createElement('span');
                            datedata.className='meta__date';
                            /*datedata.innerHTML = '<span class="meta__date"><i class="fa fa-calendar-o"></i>' + project.date + '</span>';//projects[project].date;*/
                            datedata.innerHTML = '<i class="fa fa-calendar-o"></i>' + project.date;//projects[project].date;
                                
                            var typedata = document.createElement('span');
                            typedata.className='meta__reading-time';
                            /*typedata.innerHTML = '<span class="meta__reading-time"><i class="fa fa-clock-o"></i>' + project.type + '</span>';//projects[project].date;*/
                            typedata.innerHTML = '<i class="fa fa-clock-o"></i>' + project.type;//projects[project].date;
                            
                            var datedatainner = document.createElement('i');
                            datedatainner.className='fa fa-calendar-o';
                            //datedatainner.innerHTML=projects[project].date;
                            
                            //datedata.appendChild(datedatainner);
                            metadata.appendChild(datedata);
                            metadata.appendChild(typedata);
                            
                            
                            
                            gridItem.append(image, header, loader, span, metadata);
                            //console.log(gridItem);
                            grid.appendChild(gridItem);
                            
                            //Work on the content that is more important
                            var scrollwrap = document.getElementById('pscroll-wrap');
                            var contentItem = document.createElement('article');
                            contentItem.className = 'content__item';
                            contentItem.innerHTML = project.code;
                            
                            scrollwrap.appendChild(contentItem);
                            //console.log(projects[project].code);
                            })
                            
                        }
                        
                        
                        menuItem.append(menuLink, menuMarquee, subtitle, grid);
                    }else {
                        menuItem.append(menuLink, menuMarquee, subtitle);
                    }
                    
                    //Its time to add grid and grid item
                    menuTag.appendChild(menuItem);
                    console.log('Got the data asdgfhjasgfhjasgfhjkgasfhjkasgfhjkagshjkfgashjkfgajkshgf');
                    //initEvents();
                })
            });
        });
        
        
        
        /*firebase.database().ref('Sections').once('value', function(snapshot) {
          //console.log(snapshot.val());
            //test
            
            //console.log("Compute values");
         
            //Add data ends
        snapshot.forEach(function(child) {
            //console.log(child.key+": "+child.val());
            
            //Add data starts
            var menuTag = document.getElementById('poptions');
            
            //reate a simple menu item
            var menuItem = document.createElement('div');
            menuItem.className = 'menu__item';
            menuItem.id = child.val().title; //get the section title
            
            //Create the title
            var menuLink = document.createElement('a');
            menuLink.className = 'menu__item-link';
            menuLink.innerHTML = child.val().title;
            menuLink.href = child.val().link;
            
            //Create marque
            var menuMarquee = document.createElement('div');
            menuMarquee.className = 'marquee';
            
            //Create spans
            var menuSpans = document.createElement('div');
            menuSpans.className = 'marquee__inner';
            
            //For looping
            child.val().spans.forEach(function (snap) {
                var menuSpan = document.createElement('span');
                menuSpan.innerHTML = snap;
                menuSpans.appendChild(menuSpan);
                console.log(snap);
            });
            
            //Desc
            var subtitle = document.createElement('p');
            subtitle.innerHTML = child.val().subtitle;
            
            
            //Add sub elements
            menuMarquee.appendChild(menuSpans);

            
            
            //Projects
            var projects = child.val().projects;
            //console.log(projects);
            //Create a grid
           
            
            if(projects){
                var grid = document.createElement('section');
                grid.className='grid';
                console.log('iterate');
                for(let project in projects)
                {
                     console.log(projects[project].title);
                    var gridItem = document.createElement('a');
                    gridItem.className='grid__item';
                    gridItem.href = '#';
                    
                    //Header
                    var header = document.createElement('h2');
                    header.className='title title--preview';
                    header.innerHTML = projects[project].title;
                    
                    var loader = document.createElement('div');
                    loader.className='loader';
                    
                    var span = document.createElement('span');
                    span.className='category';
                    span.innerHTML = projects[project].keywords;
                    
                    var metadata = document.createElement('div');
                    metadata.className='meta meta--preview';
                    
                    var datedata = document.createElement('span');
                    datedata.className='meta__date';
                    datedata.innerHTML = '<span class="meta__date"><i class="fa fa-calendar-o"></i>' + projects[project].date + '</span>';//projects[project].date;
                    
                    var datedatainner = document.createElement('i');
                    datedatainner.className='fa fa-calendar-o';
                    //datedatainner.innerHTML=projects[project].date;
                    
                    //datedata.appendChild(datedatainner);
                    metadata.appendChild(datedata);
                    
                    
                    
                    gridItem.append(header, loader, span, metadata);
                    console.log(gridItem);
                    grid.appendChild(gridItem);
                    
                    //Work on the content that is more important
                    var scrollwrap = document.getElementById('pscroll-wrap');
                    var contentItem = document.createElement('article');
                    contentItem.className = 'content__item';
                    contentItem.innerHTML = projects[project].code;
                    
                    scrollwrap.appendChild(contentItem);
                    //console.log(projects[project].code);
                    
                }
                
                
                menuItem.append(menuLink, menuMarquee, subtitle, grid);
            }else {
                menuItem.append(menuLink, menuMarquee, subtitle);
            }
            
            //Its time to add grid and grid item
            menuTag.appendChild(menuItem);
            initEvents();
            
            
        });
            
            
        });*/
    }

	function initEvents() {
        console.log('init events jukdasghfjkasdgfhjkgasdhjkfgjkasdhf');
        //starts
        gridEl = document.querySelector('.theGrid'),
        sidebarEl = document.getElementById('theSidebar'),
        gridItemsContainer = gridEl.querySelector('section.grid'),
        contentItemsContainer = gridEl.querySelector('section.content'),
        gridItems = gridItemsContainer.querySelectorAll('.grid__item'),
        contentItems = contentItemsContainer.querySelectorAll('.content__item'),
        closeCtrl = contentItemsContainer.querySelector('.close-button'),
        current = -1,
        lockScroll = false, xscroll, yscroll,
        isAnimating = false,
        menuCtrl = document.getElementById('menu-toggle'),
        menuCloseCtrl = sidebarEl.querySelector('.close-button');
        
        //ends
		[].slice.call(gridItems).forEach(function(item, pos) {
            console.log('grid ++');
			// grid item click event
			item.addEventListener('click', function(ev) {
				ev.preventDefault();
				if(isAnimating || current === pos) {
					return false;
				}
				isAnimating = true;
				// index of current item
				current = pos;
				// simulate loading time..
				classie.add(item, 'grid__item--loading');
				setTimeout(function() {
					classie.add(item, 'grid__item--animate');
					// reveal/load content after the last element animates out (todo: wait for the last transition to finish)
					setTimeout(function() { loadContent(item); }, 500);
				}, 1000);
			});
		});

		closeCtrl.addEventListener('click', function() {
			// hide content
			hideContent();
		});

		// keyboard esc - hide content
		document.addEventListener('keydown', function(ev) {
			if(!isAnimating && current !== -1) {
				var keyCode = ev.keyCode || ev.which;
				if( keyCode === 27 ) {
					ev.preventDefault();
					if ("activeElement" in document)
    					document.activeElement.blur();
					hideContent();
				}
			}
		} );

		// hamburger menu button (mobile) and close cross
		/*menuCtrl.addEventListener('click', function() {
			if( !classie.has(sidebarEl, 'sidebar--open') ) {
				classie.add(sidebarEl, 'sidebar--open');	
			}
		});

		menuCloseCtrl.addEventListener('click', function() {
			if( classie.has(sidebarEl, 'sidebar--open') ) {
				classie.remove(sidebarEl, 'sidebar--open');
			}
		});*/
	}

	function loadContent(item) {
		// add expanding element/placeholder 
		var dummy = document.createElement('div');
		dummy.className = 'placeholder';

		// set the width/heigth and position
		dummy.style.WebkitTransform = 'translate3d(' + (item.offsetLeft - 5) + 'px, ' + (item.offsetTop - 5) + 'px, 0px) scale3d(' + item.offsetWidth/gridItemsContainer.offsetWidth + ',' + item.offsetHeight/getViewport('y') + ',1)';
		dummy.style.transform = 'translate3d(' + (item.offsetLeft - 5) + 'px, ' + (item.offsetTop - 5) + 'px, 0px) scale3d(' + item.offsetWidth/gridItemsContainer.offsetWidth + ',' + item.offsetHeight/getViewport('y') + ',1)';

		// add transition class 
		classie.add(dummy, 'placeholder--trans-in');

		// insert it after all the grid items
		gridItemsContainer.appendChild(dummy);
		
		// body overlay
		classie.add(bodyEl, 'view-single');

		setTimeout(function() {
			// expands the placeholder
			dummy.style.WebkitTransform = 'translate3d(-5px, ' + (scrollY() - 5) + 'px, 0px)';
			dummy.style.transform = 'translate3d(-5px, ' + (scrollY() - 5) + 'px, 0px)';
			// disallow scroll
			window.addEventListener('scroll', noscroll);
		}, 25);

		onEndTransition(dummy, function() {
			// add transition class 
			classie.remove(dummy, 'placeholder--trans-in');
			classie.add(dummy, 'placeholder--trans-out');
			// position the content container
			contentItemsContainer.style.top = scrollY() + 'px';
			// show the main content container
			classie.add(contentItemsContainer, 'content--show');
			// show content item:
			classie.add(contentItems[current], 'content__item--show');
			// show close control
			classie.add(closeCtrl, 'close-button--show');
			// sets overflow hidden to the body and allows the switch to the content scroll
			classie.addClass(bodyEl, 'noscroll');

			isAnimating = false;
		});
	}

	function hideContent() {
		var gridItem = gridItems[current], contentItem = contentItems[current];

		classie.remove(contentItem, 'content__item--show');
		classie.remove(contentItemsContainer, 'content--show');
		classie.remove(closeCtrl, 'close-button--show');
		classie.remove(bodyEl, 'view-single');

		setTimeout(function() {
			var dummy = gridItemsContainer.querySelector('.placeholder');

			classie.removeClass(bodyEl, 'noscroll');

			dummy.style.WebkitTransform = 'translate3d(' + gridItem.offsetLeft + 'px, ' + gridItem.offsetTop + 'px, 0px) scale3d(' + gridItem.offsetWidth/gridItemsContainer.offsetWidth + ',' + gridItem.offsetHeight/getViewport('y') + ',1)';
			dummy.style.transform = 'translate3d(' + gridItem.offsetLeft + 'px, ' + gridItem.offsetTop + 'px, 0px) scale3d(' + gridItem.offsetWidth/gridItemsContainer.offsetWidth + ',' + gridItem.offsetHeight/getViewport('y') + ',1)';

			onEndTransition(dummy, function() {
				// reset content scroll..
				contentItem.parentNode.scrollTop = 0;
				gridItemsContainer.removeChild(dummy);
				classie.remove(gridItem, 'grid__item--loading');
				classie.remove(gridItem, 'grid__item--animate');
				lockScroll = false;
				window.removeEventListener( 'scroll', noscroll );
			});
			
			// reset current
			current = -1;
		}, 25);
	}

	function noscroll() {
		if(!lockScroll) {
			lockScroll = true;
			xscroll = scrollX();
			yscroll = scrollY();
		}
		window.scrollTo(xscroll, yscroll);
	}

	init();

})();
