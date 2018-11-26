const modifiers = require('./modifiers');

const Emojis = {
    load: options => {
        // Load and inject the SVG sprite into the DOM
        let svgPromise = Promise.resolve();
        if(options.pack_url && !document.querySelector(options.classnames.svg)) {
            svgPromise = new Promise(resolve => {
                const svgXhr = new XMLHttpRequest();
                svgXhr.open('GET', options.pack_url, true);
                svgXhr.onload = () => {
                    const container = document.createElement('div');
                    container.classList.add(options.classnames.svg);
                    container.style.display = 'none';
                    container.innerHTML = svgXhr.responseText;
                    document.body.appendChild(container);
                    resolve();
                };
                svgXhr.send();
            });
        }

        let jsonPromise;
        // Load the emojis json
        if(options.panel_type == "emoji")
        {
            const json = localStorage.getItem('EmojiPanel-json');
            jsonPromise = Promise.resolve(json)
            if(json == null) {
                jsonPromise = new Promise(resolve => {
                    const emojiXhr = new XMLHttpRequest();
                    emojiXhr.open('GET', options.json_url, true);
                    emojiXhr.onreadystatechange = () => {
                        if(emojiXhr.readyState == XMLHttpRequest.DONE && emojiXhr.status == 200) {
                            const json = JSON.parse(emojiXhr.responseText);
                            localStorage.setItem('EmojiPanel-json',emojiXhr.responseText);
                            resolve(json);
                        }
                    };
                    emojiXhr.send();
                });
            }
            else{
                jsonPromise = new Promise(resolve => {
                    const json = JSON.parse(localStorage.getItem('EmojiPanel-json'));
                    resolve(json);
                })
            }
        }
        else if(options.panel_type == "icon"){
            // const json = localStorage.getItem('IconPanel-json');
            // jsonPromise = Promise.resolve(json)
            // if(json == null) {
                jsonPromise = new Promise(resolve => {
                    const emojiXhr = new XMLHttpRequest();
                    emojiXhr.open('GET', options.json_url, true);
                    emojiXhr.onreadystatechange = () => {
                        if(emojiXhr.readyState == XMLHttpRequest.DONE && emojiXhr.status == 200) {
                            const json = JSON.parse(emojiXhr.responseText);
                            //localStorage.setItem('IconPanel-json',emojiXhr.responseText);
                            resolve(json);
                        }
                    };
                    emojiXhr.send();
                });
            // }
            // else{
            //     jsonPromise = new Promise(resolve => {
            //         const json = JSON.parse(localStorage.getItem('IconPanel-json'));
            //         resolve(json);
            //     })
            // }
        }

        return Promise.all([ svgPromise, jsonPromise ]);
    },
    createEl: (inputElement, options , baseUrl) => {
        if(options.panel_type == "emoji"){

            if(options.pack_url) {
                if(document.querySelector(`.${options.classnames.svg} [id="${inputElement.unicode}"`)) {
                    return `<svg viewBox="0 0 20 20"><use xlink:href="#${inputElement.unicode}"></use></svg>`;
                }
            }
            return inputElement.char;
            // Fallback to the emoji char if the pack does not have the sprite, or no pack
        }
        else if(options.panel_type == "icon")
        {
            return "<img src="+baseUrl+inputElement.icon_url+">";
        }
    },
    createButton: (inputElement, options, emit , baseUrl) => {

        const button = document.createElement('button');
        button.setAttribute('type', 'button');

        if(options.panel_type == "emoji"){

            if(inputElement.fitzpatrick && options.fitzpatrick) {
                // Remove existing modifiers
                Object.keys(modifiers).forEach(i => inputElement.unicode = inputElement.unicode.replace(modifiers[i].unicode, ''));
                Object.keys(modifiers).forEach(i => inputElement.char = inputElement.char.replace(modifiers[i].char, ''));

                // Append fitzpatrick modifier
                inputElement.unicode += modifiers[options.fitzpatrick].unicode;
                inputElement.char += modifiers[options.fitzpatrick].char;
            }

            button.innerHTML = Emojis.createEl(inputElement, options);
            button.classList.add('emoji');
            button.dataset.unicode = inputElement.unicode;
            button.dataset.char = inputElement.char;
            button.dataset.category = inputElement.category;
            button.dataset.name = inputElement.name;
            button.title = inputElement.name;
            if(inputElement.fitzpatrick) {
                button.dataset.fitzpatrick = inputElement.fitzpatrick;
            }
            if(emit) {
                button.addEventListener('click', () => {
                    emit('select', inputElement);

                    if(options.editable) {
                        Emojis.write(inputElement, options);
                    }
                });
            }
        }
        else if(options.panel_type == "icon"){

            button.innerHTML = Emojis.createEl(inputElement, options,baseUrl);
            button.classList.add('icon_pack');
            button.dataset.name = inputElement.name;

            if(emit) {
                button.addEventListener('click', () => {
                    emit('select', inputElement);

                    if(options.editable) {
                        Emojis.write(inputElement, options);
                    }
                });
            }
        }
        return button;
    },
    write: (inputElement, options) => {
        const input = options.editable;
        if(!input) {
            return;
        }
        if(options.panel_type == "emoji"){

            // Insert the emoji at the end of the text by default
            let offset = input.textContent.length;
            if(input.dataset.offset) {
                // Insert the emoji where the rich editor caret was
                offset = input.dataset.offset;
            }

            // Insert the pictographImage
            const pictographs = input.parentNode.querySelector('.EmojiPanel__pictographs');
            const url = 'https://abs.twimg.com/emoji/v2/72x72/' + emoji.unicode + '.png';
            const image = document.createElement('img');
            image.classList.add('RichEditor-pictographImage');
            image.setAttribute('src', url);
            image.setAttribute('draggable', false);
            pictographs.appendChild(image);

            const span = document.createElement('span');
            span.classList.add('EmojiPanel__pictographText');
            span.setAttribute('title', emoji.name);
            span.setAttribute('aria-label', emoji.name);
            span.dataset.pictographText = emoji.char;
            span.dataset.pictographImage = url;
            span.innerHTML = '&emsp;';

            // If it's empty, remove the default content of the input
            const div = input.querySelector('div');
            if(div.innerHTML == '<br>') {
                div.innerHTML = '';
            }

            // Replace each pictograph span with it's native character
            const picts = div.querySelectorAll('.EmojiPanel__pictographText');
            [].forEach.call(picts, pict => {
                div.replaceChild(document.createTextNode(pict.dataset.pictographText), pict);
            });

            // Split content into array, insert emoji at offset index
            let content = emojiAware.split(div.textContent);
            content.splice(offset, 0, emoji.char);
            content = content.join('');

            div.textContent = content;

            // Trigger a refresh of the input
            const event = document.createEvent('HTMLEvents');
            event.initEvent('mousedown', false, true);
            input.dispatchEvent(event);

            // Update the offset to after the inserted emoji
            input.dataset.offset = parseInt(input.dataset.offset, 10) + 1;

            if(options.frequent == true) {
                Frequent.add(emoji, Emojis.createButton);
            }
        }
        else if(options.panel_type == "icon"){

        }
    }
};

module.exports = Emojis;
