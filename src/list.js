const Emojis = require('./emojis');
const modifiers = require('./modifiers');

const list = (options, panel, json, emit) => {
    const categories = panel.querySelector('.' + options.classnames.categories);
    const searchInput = panel.querySelector('.' + options.classnames.searchInput);
    const searchTitle = panel.querySelector('.' + options.classnames.searchTitle);
    const frequentTitle = panel.querySelector('.' + options.classnames.frequentTitle);
    const results = panel.querySelector('.' + options.classnames.results);
    const emptyState = panel.querySelector('.' + options.classnames.noResults);
    const footer = panel.querySelector('.' + options.classnames.footer);

    // Update the category links
    while (categories.firstChild) {
        categories.removeChild(categories.firstChild);
    }
    if(options.panel_type != "giph"){
        Object.keys(json).forEach(i => {
            const category = json[i];
            console.log(category)
            // Don't show the link to a hidden category
            if(options.hidden_categories.indexOf(category.name) > -1) {
                return;
            }

            const categoryLink = document.createElement('button');

            categoryLink.setAttribute('title', category.name);
            if(options.panel_type == "emoji")
            {
                categoryLink.classList.add(options.classnames.emoji);
                categoryLink.innerHTML = Emojis.createEl(category.icon, options);
            }
            else if(options.panel_type == "icon")
            {
                categoryLink.classList.add("header_icons");
                categoryLink.innerHTML = Emojis.createEl(category.icon_pack, options, category.base_url);
            }

            categoryLink.addEventListener('click', e => {
                let strippedSpace =  category.name.replace(/\s/g,"_");
                const title = options.container.querySelector('#' + strippedSpace);
                scrollTo(results , title.offsetTop - results.offsetTop , 500);
            });
            categories.appendChild(categoryLink);
        });
    }
    else {
        Object.keys(json).forEach(i => {
            const image_url = json[i].images.original.url;;
            let imageTemplate = document.createElement('img');
            imageTemplate.src = image_url;
            console.log(results);
            results.appendChild(imageTemplate);
            // console.log(category.images.original.url)
        });
    }

    // credits for this piece of code(scrollTo pure js) to adnJosh https://gist.github.com/andjosh
    function scrollTo(element, to, duration) {
        var start = element.scrollTop,
            change = to - start,
            currentTime = 0,
            increment = 20;

        var animateScroll = function(){
            currentTime += increment;
            var val = Math.easeInOutQuad(currentTime, start, change, duration);
            element.scrollTop = val;
            if(currentTime < duration) {
                setTimeout(animateScroll, increment);
            }
        };
        animateScroll();
    }
    if(options.panel_type != "giph"){
    //t = current time
    //b = start value
    //c = change in value
    //d = duration
    Math.easeInOutQuad = function (t, b, c, d) {
      t /= d/2;
        if (t < 1) return c/2*t*t + b;
        t--;
        return -c/2 * (t*(t-2) - 1) + b;
    };

    // Handle the search input
    if(options.search == true) {

        searchInput.addEventListener('input', e => {
            let emojis ,  icons ;
            if(options.panel_type == "emoji")
            {
                emojis = results.querySelectorAll('.' + options.classnames.emoji);
            }
            else if(options.panel_type == "icon")
            {
                icons = results.querySelectorAll('.' + options.classnames.icons);
            }

            const titles = results.querySelectorAll('.' + options.classnames.category);

            let frequentList = localStorage.getItem('EmojiPanel-frequent');
            if(frequentList) {
                frequentList = JSON.parse(frequentList);
            } else {
                frequentList = [];
            }

            const value = e.target.value.replace(/-/g, '').toLowerCase();
            if(value.length > 0) {
                const matched = [];
                Object.keys(json).forEach(i => {
                    const category = json[i];
                    if(options.panel_type == "emoji")
                    {
                        category.emojis.forEach(emoji => {
                            const keywordMatch = emoji.keywords.find(keyword => {
                                keyword = keyword.replace(/-/g, '').toLowerCase();
                                return keyword.indexOf(value) > -1;
                            });
                            if(keywordMatch) {
                                matched.push(emoji.unicode);
                            }
                        });
                    }
                    else if(options.panel_type == "icon")
                    {
                        category.icons.forEach(icon => {
                            const keywordMatch = icon.keywords.find(keyword => {
                                keyword = keyword.replace(/-/g, '').toLowerCase();
                                return keyword.indexOf(value) > -1;
                            });
                            if(keywordMatch) {
                                matched.push(icon.name);
                            }
                        });
                    }
                });
                if(matched.length == 0) {
                    emptyState.style.display = 'block';
                } else {
                    emptyState.style.display = 'none';
                }

                emit('search', { value, matched });

                if(options.panel_type == "emoji"){
                    [].forEach.call(emojis, emoji => {
                        if(matched.indexOf(emoji.dataset.unicode) == -1) {
                            emoji.style.display = 'none';
                        } else {
                            emoji.style.display = 'inline-block';
                        }
                    });
                }
                else if(options.panel_type == "icon"){
                    [].forEach.call(icons, icon => {
                        if(matched.indexOf(icon.dataset.name) == -1) {
                            icon.style.display = 'none';
                        } else {
                            icon.style.display = 'inline-block';
                        }
                    });
                }

                [].forEach.call(titles, title => {
                    title.style.display = 'none';
                });
                searchTitle.style.display = 'block';

                if(options.frequent == true) {
                    frequentTitle.style.display = 'none';
                }
            } else {
                let emojis = results.querySelectorAll('.' + options.classnames.emoji);
                let icons = results.querySelectorAll('.' + options.classnames.icons);

                if(options.panel_type == "emoji"){
                    [].forEach.call(emojis, emoji => {
                        emoji.style.display = 'inline-block';
                    });
                }
                else if(options.panel_type == "icon"){
                    [].forEach.call(icons, icon => {
                        icon.style.display = 'inline-block';
                    });
                }
                [].forEach.call(titles, title => {
                    title.style.display = 'block';
                });
                searchTitle.style.display = 'none';
                emptyState.style.display = 'none';

                if(options.frequent == true) {
                    if(frequentList.length > 0) {
                        frequentTitle.style.display = 'block';
                    } else {
                        frequentTitle.style.display = 'none';
                    }
                }
            }
        });
    }

    // Fill the results with emojis
    while (results.firstChild) {
        results.removeChild(results.firstChild);
    }

        Object.keys(json).forEach(i => {
            const category = json[i];

            // Don't show any hidden categories
            if(options.hidden_categories.indexOf(category.name) > -1 || category.name == 'modifier') {
                return;
            }

            // Create the category title
            const title = document.createElement('p');
            title.classList.add(options.classnames.category);
            let strippedSpace =  category.name.replace(/\s/g,"_");
            title.id = strippedSpace;
            let categoryName = category.name.replace(/_/g, ' ')
                .replace(/\w\S*/g, (name) => name.charAt(0).toUpperCase() + name.substr(1).toLowerCase())
                .replace('And', '&amp;');
            title.innerHTML = categoryName;
            results.appendChild(title);

            // Create the emoji buttons
            if(options.panel_type == "emoji"){
                category.emojis.forEach(function(emoji){
                    results.appendChild(Emojis.createButton(emoji, options, emit));
                })
            }
            else if(options.panel_type == "icon"){
                category.icons.forEach(function(icon){
                    results.appendChild(Emojis.createButton(icon, options, emit, category.base_url));
                })
            }
        });

        if((options.fitzpatrick)&&(options.panel_type == "emoji")){
            // Create the fitzpatrick modifier button
            const hand = { // ✋
                unicode: '270b' + modifiers[options.fitzpatrick].unicode,
                char: '✋'
            };
            let modifierDropdown;
            const modifierToggle = document.createElement('button');
            modifierToggle.setAttribute('type', 'button');
            modifierToggle.classList.add(options.classnames.btnModifier, options.classnames.btnModifierToggle, options.classnames.emoji);
            modifierToggle.innerHTML = Emojis.createEl(hand, options);
            modifierToggle.addEventListener('click', () => {
                modifierDropdown.classList.toggle('active');
                modifierToggle.classList.toggle('active');
            });
            footer.appendChild(modifierToggle);

            modifierDropdown = document.createElement('div');
            modifierDropdown.classList.add(options.classnames.modifierDropdown);
            Object.keys(modifiers).forEach(m => {
                const modifier = Object.assign({}, modifiers[m]);
                modifier.unicode = '270b' + modifier.unicode;
                modifier.char = '✋' + modifier.char;
                const modifierBtn = document.createElement('button');
                modifierBtn.setAttribute('type', 'button');
                modifierBtn.classList.add(options.classnames.btnModifier, options.classnames.emoji);
                modifierBtn.dataset.modifier = m;
                modifierBtn.innerHTML = Emojis.createEl(modifier, options);

                modifierBtn.addEventListener('click', e => {
                    e.stopPropagation();
                    e.preventDefault();

                    modifierToggle.classList.remove('active');
                    modifierToggle.innerHTML = Emojis.createEl(modifier, options);

                    options.fitzpatrick = modifierBtn.dataset.modifier;
                    modifierDropdown.classList.remove('active');

                    // Refresh every emoji in any list with new skin tone
                    const emojis = [].forEach.call(options.container.querySelectorAll(`.${options.classnames.results}  .${options.classnames.emoji}`), emoji => {
                        if(emoji.dataset.fitzpatrick) {
                            const emojiObj = {
                                unicode: emoji.dataset.unicode,
                                char: emoji.dataset.char,
                                fitzpatrick: true,
                                category: emoji.dataset.category,
                                name: emoji.dataset.name
                            }
                            emoji.parentNode.replaceChild(Emojis.createButton(emojiObj, options, emit), emoji);
                        }
                    });
                });

                modifierDropdown.appendChild(modifierBtn);
            });
            footer.appendChild(modifierDropdown);
        }
    }
};

module.exports = list;
