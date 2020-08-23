import dependencyInjector from 'RootPath/dependency-injector';
import DropdownView from 'Modules/dropdown/dropdown-view';
import DetailView from 'Modules/detail/detail-view.js';
import CardView from 'Modules/card/card-view.js';
import Message from 'Utility/message';
const _ = require('lodash');
let singleton = Symbol();

class DetailEventHandler {

    constructor() {
        this.user = dependencyInjector('User');
        this.html = dependencyInjector('Html');
        this.label = dependencyInjector('Label');
        this.enums = dependencyInjector('Enums');
        this.message = dependencyInjector('Message');
        this.gmailAPI = dependencyInjector('GmailAPI');
        this.calendar = dependencyInjector('Calendar');
        this.customUi = dependencyInjector('CustomUi');
        this.teamBoard = dependencyInjector('TeamBoard');
        this.mailAction = dependencyInjector('MailAction');
        this.entityEmail = dependencyInjector('EntityEmail');
        this.sendToColumn = dependencyInjector('SendToColumn');
        this.popupWrapper = dependencyInjector('PopupWrapper');
        this.detailService = dependencyInjector('DetailService');
        this.formValidation = dependencyInjector('FormValidation');
        this.teamBoardEventHandler = dependencyInjector('TeamBoardEventHandler');
        this.mailActionEventHandler = dependencyInjector('MailActionEventHandler');
    }

    static get instance() {
        if (!this[singleton]) {
            this[singleton] = new DetailEventHandler();
        }
        return this[singleton];
    }
    getToolbars() {
        return dependencyInjector('Toolbars');
    }
    startListeners() {
        const self = this;

        self.changeTabHandler();
        self.backToBoardHandler();
        self.leaveDetailHandler();
        self.changeCardTitleHandler();

        self.removeTagHandler();
        self.changeColorHandler();
        self.selectBoardHandler();
        self.changeColumnHandler();
        self.assignHandler();
        self.setDueDateHandler();
        self.removeDueDateHandler();
        self.manageTagsHandler();
        self.navigationHandler();

        self.toggleEmailHandler();
        self.toggleEmailDetailsHandler();
        self.toggleDueDateDropdownHandler();
        self.toggleSendToColumnHandler();
        self.toggleMoveToHandler();
        self.toggleAssignLabelHandler();
        self.toggleManageColorHandler();
        self.toggleTagHandler();
        self.toggleAssignHandler();
        self.showOlderEmailsHandler();
        self.showTrimmedEmailHandler();
        self.downloadAttachmentHandler();

        self.moveToHandler();
        self.detailLabelHandler();
        self.archiveHandler();
        self.ReportAsSpamHandler();
        self.deleteHandler();
        self.markAsUnreadHandler();
        self.markAsStarHandler();
        self.replyHandler();
        self.replyAsHandler();
        self.replyAllHandler();
        self.forwardHandler();

        self.addCommentHandler();
        self.updateCommentHandler();
        self.deleteCommentHandler();
        self.toggleCommentsHandler();

        self.addTaskHandler();
        self.updateTaskHandler();
        self.deleteTaskHandler();
        self.markTaskAsCompletedHandler();
        self.resizeTaskTextareaHandler();

        self.updateNotesHandler();

        self.navigateToBoardHandler();
        self.navigateToCardHandler();
        self.refreshPositionHandler();
    }

    showDetail(entityId, navigateToCardBoardId = null) {
        let self = this;

        if (entityId == null || entityId == '') {
            return;
        }

        const entityType = self.enums.getEntityType(entityId);
        let boardId = navigateToCardBoardId ? navigateToCardBoardId : self.teamBoardEventHandler.getBoardId();

        const card = $(`#${entityId}`);
        const { subject, isRead } = card.find('.card-email').first().data() || {};

        const boards = self.teamBoard.getTeamBoardList();
        const columnsByBoard = self.teamBoard.getTeamBoardColumns();
        const navigationData = self.detailService.getNavigationData(entityId, boardId, boards, columnsByBoard);

        const detail = new DetailView(entityId)
            .open()
            .setBoardId(boardId)
            .setColumnId(navigationData.currentColumn)
            .setBoards(boards)
            .setColumns(navigationData.columns, boardId)
            .setPrevious(navigationData.previous)
            .setNext(navigationData.next)
            .setRead(isRead)
            .setMoreMenu()
            .setSubject(subject);
            // .setParticipants(['Nick', 'Nadya', 'Breno', 'Caio', 'Rafael']);

        if (entityType == self.enums.ENTITY_TYPE.TASK) {
            detail.goToTab('tasks');
        }

        history.pushState({ entityId, boardId }, null, location.hash);
        window.onpopstate = event => {
            if (!DetailView.isOpen() || DetailView.hasCompose() || DetailView.isLoading()) {
                return;
            }

            let entityId = DetailView.getEntityId();
            return new DetailView(entityId).close();
        };
        self.detailService.getDetails(boardId, entityId, entityType).then(async data => {
            detail
                .setOwner(data.emailOwner)
                .setEmails(data.emails)
                .setTitle(data.title)
                .setColor(data.color != null ? data.color : -1)
                .setNote(data.note)
                // .setStar(data.starred)
                .setSubtitle(data.ownerName, data.createdAt)
                .setDueDate(data.dueDate);
            const card = new CardView(entityId)
                .removeNotifications()
                .setRead(true);
            // if for some reason, columnId or boardId weren't set correctly, usually toggle off, set them with DB data
            if (_.isEmpty(detail.getColumnId()) || _.isEmpty(detail.getBoardId())) {
                const boards = self.teamBoard.getTeamBoardList();
                const columnsByBoard = self.teamBoard.getTeamBoardColumns();
                const navigationData = self.detailService.getNavigationData(entityId, data.boardId, boards, columnsByBoard);
                boardId = data.boardId;

                detail
                    .setBoardId(data.boardId)
                    .setColumnId(data.columnId)
                    .setBoards(boards)
                    .setColumns(navigationData.columns, data.boardId)
                    .setPrevious(navigationData.previous)
                    .setNext(navigationData.next);
            }

            self.loadAssignments(entityId, boardId);
            self.loadTags(entityId, boardId);
            self.loadCheckListTasks(entityId, entityType, boardId);

            const { sharedDraft } = data;
            if (!sharedDraft) {
                return;
            }

            if (!self.entityEmail.isSharedDraftAvailable(sharedDraft)) {
                self.message.showMessage(`${sharedDraft.DraftOwnerName} is already writing a reply to this message.`, 3000);
                return;
            }

            const messageId = _.isEmpty(sharedDraft.MessageId) ? sharedDraft.ThreadId : sharedDraft.MessageId;
            const type = _.isEmpty(sharedDraft.DraftType) ? 'reply' : sharedDraft.DraftType;

            const { hasDraft } = await self.detailService.getMessageData(messageId, entityId, boardId);
            if (!hasDraft) {
                // shared draft was in the database, but the draft was deleted via gmail
                // in this case, the previous request already excludes the shared draft from database and notifies board members
                return card.hideDraft();
            }

            detail.clickOnMessageAction(messageId, type);
        })
        .catch(err => {
            console.log(err);
        });

        self.loadComments(entityId, entityType);
    }

    loadAssignments(entityId, boardId) {
        const self = this;
        let defaultReplyAsEmail;
        _.forEach(self.teamBoard.getTeamBoardList(), (teamBoard) => {
            if (teamBoard.Id == boardId) {
                defaultReplyAsEmail = teamBoard.ReplyAsEmail;
            }
        });
        Promise.all([
            self.detailService.getAssignees(entityId),
            self.detailService.getTeamBoardInvitationList(boardId)
        ])
        .then((result) => {
            let assignees = result[0];
            const users = result[1];
            let userEmail = self.user.getUserEmailAddress();
            let currentBoardId = self.teamBoardEventHandler.getBoardId();
            let currentBoardMembers = self.teamBoard.getCurrentBoardContributorEmails(currentBoardId, userEmail);
            let memberList = self.teamBoardEventHandler.getMemberList();
            currentBoardMembers.unshift(userEmail);
            assignees = assignees.filter(assignee => currentBoardMembers.includes(assignee))
            new DetailView(entityId)
                .setAssignees(assignees, users)
                .setMentionsDropdown(users)
                .setReplyAsContributors(users, defaultReplyAsEmail);
        }).catch((err) => {
            console.log(err);
        });
    }

    loadTags(entityId, boardId) {
        const self = this;

        Promise.all([
            self.detailService.getBoardTags(boardId),
            self.detailService.getTags(entityId, boardId)
        ]).then(tagsData => {
            const boardTags = tagsData[0];
            const threadTags = tagsData[1];

            new DetailView(entityId).setTags(threadTags, boardTags);
        }).catch(err => {
            console.log(err);
        });
    }

    loadComments(entityId, entityType) {
        const self = this;

        self.detailService.getComments(entityId, entityType).then(comments => {
            new DetailView(entityId).setComments(comments);
        })
        .catch(err => {
            console.log(err);
        });
    }

    loadCheckListTasks(entityId, entityType, boardId) {
        const self = this;

        self.detailService.getCheckListTasks(entityId, entityType, boardId).then(tasks => {
            new DetailView(entityId).setTasks(tasks);
            self.dragTaskHandler();
        })
        .catch(err => {
            console.log(err);
        });
    }

    changeTabHandler() {
        const selector = '.detail-container .detail-body .detail-tabs .detail-tab:not([disabled])';
        $(document).off('click', selector).on('click', selector, event => {
            const entityId = DetailView.getEntityId();
            const tab = $(event.target).closest('.detail-tab').data('tabIndex');
            new DetailView(entityId).goToTab(tab);
        });
    }

    toggleCommentsHandler() {
        const selector = '.detail-container .gmail-action.toggle-comments';
        $(document).off('click', selector).on('click', selector, event => {
            $('.detail-comments-container').toggleClass('hidden');
            let userEmail = this.user.getUserEmailAddress();
            localStorage.setItem(`${userEmail}_showComments`, $('.detail-comments-container').hasClass('hidden') ? '0' : '1');
            const entityId = DetailView.getEntityId();
            new DetailView(entityId).dispatchResizeTrigger();
        });
    }

    backToBoardHandler() {
        const selector = '.detail-container .detail-header .detail-back-to-board-background';
        $(document).off('click', selector).on('click', selector, event => {
            const entityId = DetailView.getEntityId();
            new DetailView(entityId).close();
        });
    }

    leaveDetailHandler() {
        const handleLeaveDetail = event => {
            // ignore right mouse click
            if (event.which == 3) {
                return;
            }
            const target = $(event.target).not('.link_undo');

            const clickedOnAddon = target.closest('.bq9.buW').length;
            const clickedOnAddonBar = target.closest('.nH.bAw.nn').length;
            if (clickedOnAddon || clickedOnAddonBar) {
                return;
            }

            const clickedOnPopup = target.closest('.popup').length;
            if (clickedOnPopup) {
                return;
            }

            const clickedOnGmailEmails = target.closest('.nH.bkK .nH .nH.ar4 .AO .Tm .aeF div[role="main"]').length;
            if (clickedOnGmailEmails) {
                return;
            }

            const entityId = DetailView.getEntityId();
            const detail = new DetailView(entityId);

            const clickedOnTopBar = target.closest('.nH.w-asV.aiw').find('.nH.oy8Mbf.qp').length;
            const clickedOnSearchBox = target.closest('#aso_search_form_anchor').length;
            if (clickedOnTopBar && !clickedOnSearchBox) {
                return detail.close();
            }

            const clickedOnLeftBar = target.closest('.nH.bkL').find('.nH.oy8Mbf.nn.aeN .Ls77Lb.aZ6').length;
            const clickedOnComposeButton = target.hasClass('T-I J-J5-Ji T-I-KE L3');
            if (clickedOnLeftBar && !clickedOnComposeButton) {
                return detail.close();
            }
        };

        const selector = 'body.displaying-detail-page';
        $(document).off('mouseup', selector).on('mouseup', selector, handleLeaveDetail);
        $(document).off('click', selector).on('click', selector, handleLeaveDetail);
    }

    changeCardTitleHandler() {
        let self = this;
        let oldTitle = '';

        let selector = '.detail-container .detail-header .detail-title';
        $(document).off('click', selector).on('click', selector, event => {
            const titleElement = $(event.target).closest('.detail-title');
            const lastSavedTitle = titleElement.attr('data-saved-title');
            oldTitle = typeof lastSavedTitle === 'string' && lastSavedTitle.trim().length ? lastSavedTitle : '';

            $(event.target).closest('.detail-container').addClass('editing-title');
            titleElement.find('.detail-title-text').attr('contenteditable', true).focus();
        });

        selector = '.detail-container .detail-title-text';
        $(document).off('focusout', selector).on('focusout', selector, async event => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);
            const detail = new DetailView(entityId);
            const columnId = detail.getColumnId();
            const boardId = detail.getBoardId();

            const newTitle = $(event.target).text().trim();
            if (!newTitle.length) {
                const restoredTitle = !oldTitle.trim().length ? '' : oldTitle;
                detail.setTitle(restoredTitle);
                self.message.showGmailErrorMessages('Please add a valid title.');
                return;
            }

            await self.detailService.updateCardTitle(entityId, entityType, columnId, boardId, newTitle);
            detail.setTitle(newTitle);
            new CardView(entityId).setTitle(newTitle);
        });

        $(document).off('keydown', selector).on('keydown', selector, event => {
            if (event.keyCode == 13) {
                event.preventDefault();
                const titleElement = $(event.target).closest('.detail-title');
                titleElement.find('.detail-title-text').attr('contenteditable', false);
            }
        });
    }

    removeTagHandler() {
        const self = this;

        const selector = '.detail-container .detail-header .detail-tag .detail-tag-close';
        $(document).off('click', selector).on('click', selector, async event => {
            const entityId = DetailView.getEntityId();
            const tag = $(event.target).closest('.detail-tag');
            const entityLabelId = tag.attr('data-entity-label-id');
            const labelId = tag.attr('data-id');

            await self.detailService.removeTag(entityLabelId, entityId);
            tag.remove();
            new CardView(entityId).removeTag(labelId);
        });
    }

    changeColumnHandler() {
        let self = this;

        const selector = '.detail-container .detail-header .detail-columns-container .detail-columns .detail-column:not([selected])';
        $(document).off('click', selector).on('click', selector, async event => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);
            const detail = new DetailView(entityId);
            const oldColumnId = detail.getColumnId();
            const oldBoardId = detail.getBoardId();
            const newColumnId = $(event.target).attr('data-column-id');
            const newBoardId = $(event.target).attr('data-board-id');
            const changedBoard = oldBoardId != newBoardId;

            if (self.user.isOnFreePlan() && changedBoard) {
                return self.popupWrapper.paymentPopup();
            }

            if (!self.sendToColumn.canSendThreadsToBoard([entityId], newBoardId)) {
                return self.message.showGmailErrorMessages(Message.cannot_move_emails_that_are_not_your_own_away_from_this_shared_board);
            }

            await self.detailService.move(entityId, entityType, oldColumnId, oldBoardId, newColumnId, newBoardId);

            const boards = self.teamBoard.getTeamBoardList();
            const columnsByBoard = self.teamBoard.getTeamBoardColumns();
            const navigationData = self.detailService.getNavigationData(entityId, newBoardId, boards, columnsByBoard);

            detail
                .setBoardId(newBoardId)
                .setColumnId(navigationData.currentColumn)
                .setBoards(boards)
                .setColumns(navigationData.columns, newBoardId);

            // if card changed board, reload assignments and tags dropdowns
            if (changedBoard) {
                self.loadAssignments(entityId, newBoardId);
                self.loadTags(entityId, newBoardId);
            }

            const openedBoardId = self.teamBoardEventHandler.getBoardId();
            const inOpenedBoard = newBoardId == openedBoardId;
            const outOpenedBoard = oldBoardId == openedBoardId;
            const unrelatedToOpenedBoard = !inOpenedBoard && !outOpenedBoard;

            if (unrelatedToOpenedBoard) {
                return;
            }

            const card = new CardView(entityId);

            if (!changedBoard) {
                return card.moveToColumn(newColumnId);
            }

            if (outOpenedBoard) {
                return card.remove();
            }

            if (inOpenedBoard) {
                return self.mailActionEventHandler.recoverBoard();
            }
        });

        const arrowsSelector = '.detail-container .detail-header .detail-columns-container .detail-columns-arrows .detail-columns-arrow:not([data-available-clicks="0"])';
        $(document).off('click', arrowsSelector).on('click', arrowsSelector, event => {
            const direction = Number($(event.target).attr('data-scroll-direction'));
            const columnsElement = $(event.target).closest('.detail-columns-container').find('.detail-columns');
            const scrollWidth = columnsElement.scrollLeft() + (119 * direction);
            columnsElement.scrollLeft(scrollWidth);

            const previousArrowElement = $('.new-previous');
            previousArrowElement.attr('data-available-clicks', Number(previousArrowElement.attr('data-available-clicks')) + direction);

            const nextArrowElement = $('.new-next');
            nextArrowElement.attr('data-available-clicks', Number(nextArrowElement.attr('data-available-clicks')) - direction);
        });
    }
    hideAll() {
        setTimeout(() => {
            $('.detail-container #detail-email-label .dragapp-dropdown').hide();
            $('.detail-container #detail-email-move-to .dragapp-dropdown').hide();
        }, 10);
        $('.detail-container #colDropDwon').hide();
        $('#detail-due-date-picker-box').hide();
        $('.dropdown-trigger .dropdown-container nav.dropdown:not(.hidden)').each((index, element) => {
            const parentId = $(element).closest('.dropdown-trigger').attr('id');
            new DropdownView(`#${parentId}`).hide();
        });
    }


    toggleTagHandler() {
        const self = this;
        $(document).off('click', 'body:not(.dropdown)').on('click', 'body:not(.dropdown)', event => {
            $('.detail-container #colDropDwon').hide();
        });

        $(document).off('click', '.detail-container #detail-email-tag').on('click', '.detail-container #detail-email-tag',async event => {
            event.stopPropagation();
            if ($('.detail-container #detail-email-tag #colDropDwon').is(":hidden")) {
                self.hideAll();
                let userEmail = this.user.getUserEmailAddress();
                let boardId = this.teamBoardEventHandler.getBoardId();
                let assignees = await self.detailService.getTeamBoardInvitationList(boardId);
                let html = self.html.getLabelsDropdown(userEmail, boardId, self.label.labels);
                $('.detail-container #detail-email-tag').html(
                    html
                );
                $('.detail-container #detail-email-tag #colDropDwon').show();
                let objs = document.querySelectorAll('.detail-container .detail-tags .detail-tag');
                for (let i = 0; i < objs.length; i++) {
                     $(`.customLabel-li[data-id="${$(objs[i]).attr('data-id')}"]`).addClass('selected-li');
                 }
            }
            else {
                if (event.target.id == 'detail-email-tag')
                    $('.detail-container #detail-email-tag #colDropDwon').hide();
            }
        });
    }
    toggleAssignHandler() {
        const self = this;
        $(document).off('click', 'body:not(.dropdown)').on('click', 'body:not(.dropdown)', event => {
            $('.detail-container #colDropDwon').hide();
        });

        $(document).off('click', '.detail-container #detail-email-assigns').on('click', '.detail-container #detail-email-assigns',async event => {
            event.stopPropagation();
            if ($('.detail-container #detail-email-assigns #colDropDwon').is(":hidden")) {
                self.hideAll();
                let userEmail = this.user.getUserEmailAddress();
                let boardId = this.teamBoardEventHandler.getBoardId();
                let assignees = await self.detailService.getTeamBoardInvitationList(boardId);
                let html = self.html.getAssignDropdown(userEmail, boardId, assignees);
                $('.detail-container #detail-email-assigns').html(
                    html
                );
                $('.detail-container #detail-email-assigns #colDropDwon').show();
                const threadId = $(event.target).closest('.detail-container').data('id');
                let assignedList = await self.detailService.getAssignees(threadId);
                for (let i = 0; i < assignedList.length; i++) {
                     $(`.customAssign-li[data-email="${assignedList[i]}"]`).addClass('selected-li');
                 }
            }
            else {
                if (event.target.id == 'detail-email-assigns')
                    $('.detail-container #detail-email-assigns #colDropDwon').hide();
            }
        });
    }
    toggleManageColorHandler() {
        const self = this;
        $(document).off('click', 'body:not(.dropdown)').on('click', 'body:not(.dropdown)', event => {
            $('.detail-container #colDropDwon').hide();
        });

        $(document).off('click', '.detail-container #detail-email-color').on('click', '.detail-container #detail-email-color', event => {
            event.stopPropagation();
            if ($('.detail-container #detail-email-color #colDropDwon').is(":hidden")) {
                self.hideAll();
                $('.detail-container #detail-email-color #colDropDwon').show();
            }
            else {
                if (event.target.id == 'detail-email-color')
                    $('.detail-container #detail-email-color #colDropDwon').hide();
            }
        });
    }
    toggleAssignLabelHandler() {
        const self = this;
        $(document).off('click', 'body:not(#detail-email-label)').on('click', 'body:not(#detail-email-label)', event => {
            setTimeout(() => {
                $('.detail-container #detail-email-label .dragapp-dropdown').hide();
            }, 10);
        });
    }
    toggleMoveToHandler() {
        const self = this;
        $(document).off('click', 'body:not(#detail-email-move-to)').on('click', 'body:not(#detail-email-move-to)', event => {
            setTimeout(() => {
                $('.detail-container #detail-email-move-to .dragapp-dropdown').hide();
            }, 10);
        });
    }
    toggleSendToColumnHandler() {
        const self = this;
        $(document).off('click', 'body:not(.detail-container #colDropDwon)').on('click', 'body:not(.detail-container #colDropDwon)', event => {
            $('.detail-container #colDropDwon').hide();
        });

        $(document).off('click', '.detail-container #detail-email-send-to-column').on('click', '.detail-container #detail-email-send-to-column', event => {
            event.stopPropagation();

            if ($('.detail-container #detail-email-send-to-column #colDropDwon').is(":hidden")) {
                self.hideAll();
                $('.detail-container #detail-email-send-to-column #colDropDwon').show();
            }
            else {
                if (event.target.id == 'detail-email-send-to-column')
                    $('.detail-container #detail-email-send-to-column #colDropDwon').hide();
            }
        });
    }
    toggleDueDateDropdownHandler() {
        const self = this;
        $(document).off('click', 'body:not(.detail-column-container)').on('click', 'body:not(.detail-column-container)', event => {
            $('#detail-due-date-picker-box').hide();
        });
        $(document).off('click', '#new-detail-due-date-picker:not(.dropdown)').on('click', '#new-detail-due-date-picker:not(.dropdown)', event => {
            event.stopPropagation();
            if ($('#detail-due-date-picker-box').is(":hidden")) {
                self.hideAll();
                $('#detail-due-date-picker-box').show();
            }
            else {
                if (event.target.id == 'new-detail-due-date-picker')
                    $('#detail-due-date-picker-box').hide();
            }
        });
    }
    changeColorHandler() {
        let self = this;
        const selector = '.detail-container #detail-email-color';
        $(document).off('onSelect', selector).on('onSelect', selector, (event, data) => {
            const entityId = DetailView.getEntityId();
            const boardId = $('.detail-container').attr('data-board-id');
            const entityType = self.enums.getEntityType(entityId);
            const color = data.selected;

            new DetailView(entityId).setColor(color);
            new CardView(entityId).setColor(color);

            self.detailService.updateColor(entityId, entityType, color, boardId);
        });
    }

    assignHandler() {
        let self = this;

        const selector = '.detail-container #detail-email-assigns';
        $(document).off('onSelect', selector).on('onSelect', selector, (event, data) => {
            const entityId = DetailView.getEntityId();
            const boardId = $('.detail-container').attr('data-board-id');
            const assignees = data.selected;

            new DetailView(entityId).setAssignees(assignees);
            new CardView(entityId).setAssignees(assignees);

            self.detailService.assignEmail(entityId, boardId, assignees);
        });
    }

    setDueDateHandler() {
        let self = this;

        const handleDueDate = async () => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);

            const detail = new DetailView(entityId);
            const boardId = detail.getBoardId();
            const dueDate = detail.getDueDate();
            const localDate = new Date(dueDate.date + ' ' + dueDate.time);
            const utcDate = moment.utc(localDate).format('YYYY-MM-DD HH:mm:ss');

            try {
                await self.detailService.saveDueDate(entityId, entityType, utcDate, boardId);

                new CardView(entityId).setDueDate(utcDate);
                detail.setDueDate(utcDate);

                let summary = detail.getTitle();

                if (_.isEmpty(summary)) {
                    summary = detail.getSubject();
                }

                self.calendar.createEvent(summary, localDate);
            } catch(error) {
                self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                throw new Error(`DetailEventHandler.setDueDateHandler: \n${error}`);
            }
        };

        const dateSelector = '.detail-container #detail-due-date-picker-box #detail-due-date-picker-dropdown-container #due-date-datepicker';
        $(document).off('change', dateSelector).on('change', dateSelector, () => {
            handleDueDate();
            setTimeout(() => $('#detail-due-date-picker').click(), 300);
        });

        const timeSelector = '.detail-container #detail-due-date-picker-box #detail-due-date-picker-dropdown-container #due-date-timepicker';
        $(document).off('change', timeSelector).on('change', timeSelector, handleDueDate);
    }

    removeDueDateHandler() {
        let self = this;

        const selector = '.detail-container .detail-header .detail-due-date .detail-badge.detail-due-date-badge .detail-due-date-remove';
        $(document).off('click', selector).on('click', selector, async () => {
            const entityId = DetailView.getEntityId();
            const detail = new DetailView(entityId);
            const boardId = detail.getBoardId();

            try {
                await self.detailService.deleteDueDate(entityId, boardId);
                new CardView(entityId).removeDueDate();
                detail.removeDueDate();
            } catch(error) {
                self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                throw new Error(`DetailEventHandler.removeDueDateHandler: \n${error}`);
            }
        });
    }

    manageTagsHandler() {
        let self = this;

        const selector = '.detail-container #detail-email-tag';
        $(document).off('onSelect', selector).on('onSelect', selector, async (event, data) => {
            const boardId = $('.detail-container').attr('data-board-id');
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);
            const labelId = data.option.attr('data-value');
            const name = data.option.attr('data-text');
            const color = data.option.find('.dropdown-option-icon-tag').attr('data-color');
            const isSelected = data.option.is('[selected]');

            if (!isSelected) {
                const entityLabelId = $(`.detail-container .detail-tags .detail-tag[data-id="${labelId}"]`).attr('data-entity-label-id');
                self.detailService.removeTag(entityLabelId, entityId);
                new CardView(entityId).removeTag(labelId);
                new DetailView(entityId).removeTag(labelId);
                return;
            }

            const entityLabelId = await self.detailService.addTag(boardId, entityId, entityType, labelId);
            const tag = { Id: labelId, Color: color, Name: name, EntityLabelId: entityLabelId };
            new CardView(entityId).addTag(tag);
            new DetailView(entityId).addTag(tag);
        });
    }

    navigationHandler() {
        let self = this;

        const selector = '.detail-action.new-previous[data-thread-id], .detail-action.new-next[data-thread-id]';
        $(document).off('click', selector).on('click', selector, event => {
            const entityId = $(event.target).closest('.detail-action').attr('data-thread-id');
            self.showDetail(entityId);
        });
    }
    ReportAsSpam (entityId){
        const self = this;
        const detail = new DetailView(entityId);
        let entityIds = [entityId];
        let cards = [], numberOfThreads = 0, numberOfTasks = 0;
        for (let i = 0; i < entityIds.length; i++) {
            const entityId = entityIds[i];
            const entityType = self.enums.getEntityType(entityId);
            if (entityType == self.enums.ENTITY_TYPE.EMAIL) {
                numberOfThreads++;
            } else {
                numberOfTasks++;
            }

            const card = new CardView(entityId);
            cards.push(card);
            detail.close();
            card.hide();
        }

        const successCallback = async () => {
            for (let card of cards) {
                const entityId = card.id;
                const columnId = card.getColumnId();
                const boardId = card.getBoardId();
                const entityType = self.enums.getEntityType(entityId);
                if (entityType == self.enums.ENTITY_TYPE.EMAIL) {
                    await self.detailService.delete(entityId, columnId, boardId);
                    card.remove();
                    continue;
                }
                await self.detailService.deleteTask(entityId, columnId, boardId);
                card.remove();
            }
        };
        const failCallback = () => {
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                card.show();
            }
        };

        const message = `Conversation moved to Trash.`;
        self.undoable(successCallback, failCallback, message);
    }

    toggleEmailHandler() {
        const self = this;

        const selector = `
            .detail-container .detail-body .detail-email:not(.displaying-inline-compose) .detail-email-header .detail-email-info,
            .detail-container .detail-body .detail-email:not(.displaying-inline-compose) .detail-email-header .detail-email-sender-thumbnail,
            .detail-container .detail-body .detail-email:not(.displaying-inline-compose) .detail-email-header .detail-email-preview`;
        $(document).off('click', selector).on('click', selector, async event => {
            const target = $(event.target);
            const threadId = target.closest('.detail-container').data('id');
            const detail = new DetailView(threadId);

            const email = target.closest('li.detail-email');
            if (!email.hasClass('placeholder')) {
                if (email.hasClass('open')) {
                    email.removeClass('open');
                    return detail.dispatchResizeTrigger();
                }

                if (email.hasClass('loaded')) {
                    email.addClass('open');
                    return detail.dispatchResizeTrigger();
                }

                email.addClass('loading').addClass('open');
            }

            const boardId = detail.getBoardId();
            const messageId = email.attr('data-message-id');

            if (String(messageId).includes('placeholder')) {
                return;
            }

            try {
                detail.dispatchResizeTrigger();

                const data = await self.detailService.getMailData(messageId, threadId, boardId);

                email.removeClass('loading placeholder').addClass('loaded');

                detail
                    .setEmailBody(messageId, data.rfcMessageId, data.emailBody, data.attachments, data.attachmentsNotLazyLoadHtml)
                    .setEmailRecipients(messageId, data.recipients)
                    .setEmailDetails(messageId, data.mailToDesc)
                    .setEmailStar(messageId, data.starred)
                    .dispatchResizeTrigger();
            } catch (err) {
                console.log(err);
            }
        });
    }

    toggleEmailDetailsHandler() {
        const displayClass = 'displaying-email-details';
        const selector = '.detail-container .detail-body .detail-email .detail-email-header .detail-email-details';

        const hideAll = () => {
            $('.detail-container').removeClass(displayClass);
            $(selector).find('.mail-to-details').addClass('display-none');
            $(selector).each((index, element) => element.removeAttribute('data-tooltip-suspended'));
        };

        const show = detailElement => {
            hideAll();
            $('.detail-container').addClass(displayClass);
            detailElement.removeClass('display-none');
            detailElement.closest('.detail-email-details').attr('data-tooltip-suspended', true);
        };

        $(document).off('click', selector).on('click', selector, event => {
            event.stopImmediatePropagation();
            const clickedOnDetails = $(event.target).closest('.mail-to-details').length;
            if (clickedOnDetails) {
                return;
            }

            const emailDetails = $(event.target).closest('.detail-email-details').find('.mail-to-details');
            if (!emailDetails.hasClass('display-none')) {
                return hideAll();
            }

            show(emailDetails);
        })

        const hideAllSelector = `.detail-container.${displayClass}`;
        $(document).off('click', hideAllSelector).on('click', hideAllSelector, event => {
            const clickedOnDetails = $(event.target).closest('.mail-to-details').length;
            if (!clickedOnDetails) {
                hideAll();
            }
        });
    }

    showOlderEmailsHandler() {
        const selector = '.detail-container .detail-body .detail-emails-load-older';
        $(document).off('click', selector).on('click', selector, event => {
            const entityId = $(event.target).closest('.detail-container').attr('id');
            $('.detail-container .detail-body .detail-email.hidden').removeClass('hidden');
            $(selector).closest('.detail-tab-content').addClass('detail-emails-load-older-hidden');
            new DetailView(entityId).dispatchResizeTrigger();
        });
    }

    showTrimmedEmailHandler() {
        const selector = '.detail-container .detail-body li.detail-email .detail-email-content .ajR.show-quote';
        $(document).off('click', selector).on('click', selector, event => {
            const email = $(event.target).closest('li.detail-email');
            email.find('.detail-email-content .ajR.show-quote').remove();
            email.find('.detail-email-content .gmail_quote').first().show();
            const entityId = DetailView.getEntityId();
            new DetailView(entityId).dispatchResizeTrigger();
        });

        const trimmedSelector = 'body.displaying-inline-compose .inboxsdk__compose .editable .dragapp-compose-message .dragapp-show-trimmed-content';
        $(document).off('click', trimmedSelector).on('click', trimmedSelector, event => {
            const container = $(event.target).closest('.inboxsdk__compose .editable').find('.dragapp-compose-message .dragapp-content-container');
            if (container.hasClass('trimmed-content')) {
                container.removeClass('trimmed-content');
                container.addClass('full-content');
                const entityId = DetailView.getEntityId();
                new DetailView(entityId).dispatchResizeTrigger();
            }
        });
    }

    downloadAttachmentHandler() {
        const self = this;

        const selector = '.detail-container .detail-body li.detail-email .detail-email-attachments .detail-email-attachment:not(.placeholder)';
        $(document).off('click', selector).on('click', selector, async event => {
            event.stopImmediatePropagation();

            const attachment = $(event.target).closest('.detail-email-attachment');
            const { messageId, attachmentId, filename, mimeType } = attachment.data();

            try {
                attachment.addClass('loading');
                await self.detailService.downloadAttachment(messageId, attachmentId, filename, mimeType);
            } finally {
                attachment.removeClass('loading');
            }
        });
    }

    detailLabelHandler () {
        let self = this;
        const selector = '#detail-email-label';

        $(document).off('click', `${selector}:not(.label-as-dropdown)`).on('click', `${selector}:not(.label-as-dropdown)`, async event => {
            // create dropdown with labels, then open it
            event.stopPropagation();
            event.preventDefault();
            self.hideAll();
            const menuItems = await self.detailService.getMoveToLabels();
            if (!$(selector + ' .dragapp-dropdown').length || $(selector + ' .dragapp-dropdown').is(":hidden"))
                await self.mailActionEventHandler.searchOnLabelAsHandler(selector);
            else $(selector + ' .dragapp-dropdown').remove();

        });
        $(document).off('click', `#detail-email-label .label-as-dropdown`).on('click', `#detail-email-label .label-as-dropdown`, async event => {
            event.stopPropagation();
        })
        $(document).off('onSelect', selector).on('onSelect', selector, async (event, data) => {
            const threadId = DetailView.getEntityId();
            const labelId = data.selected;

            const detail = new DetailView(threadId);
            const columnId = detail.getColumnId();
            const boardId = detail.getBoardId();

            await self.detailService.addLabel(threadId, columnId, boardId, labelId);
        });
    }

    moveToHandler() {
        let self = this;

        const selector = '#detail-email-move-to';
        $(document).off('click', `${selector}:not(.move-to-dropdown)`).on('click', `${selector}:not(.move-to-dropdown)`, async event => {
            // create dropdown with labels, then open it
            event.stopPropagation();
            event.preventDefault();
            self.hideAll();
            const menuItems = await self.detailService.getMoveToLabels();
            if (!$(selector + ' .dragapp-dropdown').length || $(selector + ' .dragapp-dropdown').is(":hidden"))
                await self.mailActionEventHandler.searchOnMoveToHandler(selector);
            else $(selector + ' .dragapp-dropdown').remove();

        });
        $(document).off('click', `#detail-email-move-to .move-to-dropdown`).on('click', `#detail-email-move-to .move-to-dropdown`, async event => {
            event.stopPropagation();
        })
        $(document).off('onSelect', selector).on('onSelect', selector, async (event, data) => {
            const threadId = DetailView.getEntityId();
            const labelId = data.selected;

            const detail = new DetailView(threadId);
            const columnId = detail.getColumnId();
            const boardId = detail.getBoardId();

            await self.detailService.moveToFolder(threadId, columnId, boardId, labelId);
            new CardView(threadId).remove();
            detail.close();
        });
    }

    undoable(successCallback, failCallback, message, time = 3000) {
        let self = this;

        message += ` &nbsp&nbsp&nbsp&nbsp&nbsp<span style="color:#8ab4f8" class="link_undo" tabindex="0" role="link" idlink="" aria-label="Undo link">Undo</span>`;
        self.message.showMessage(message, time);

        let doit = true;
        $(document).off('click', '.link_undo').on('click', '.link_undo', (event) => {
            event.preventDefault();

            doit = false;
            self.message.showMessage('Action undone.', time);
            failCallback.call(self);
        });

        setTimeout(() => doit && successCallback.call(self), time);
    }

    ReportAsSpamHandler() {
        let self = this;
        const selector = '.detail-action.spam';
        $(document).off('click', selector).on('click', selector, event => {
            const threadId = DetailView.getEntityId();
            self.ReportAsSpam(threadId);
        });
    }
    archiveHandler() {
        let self = this;

        const selector = '.detail-action.archive';
        $(document).off('click', selector).on('click', selector, event => {
            const threadId = DetailView.getEntityId();
            const card = new CardView(threadId);
            const detail = new DetailView(threadId);
            const columnId = detail.getColumnId();
            const boardId = detail.getBoardId();

            const successCallback = () => {
                self.detailService.archive(threadId, columnId, boardId);
                card.remove();
            };
            const failCallback = () => {
                card.show();
            };

            card.hide();
            detail.close();
            self.undoable(successCallback, failCallback, 'Conversation archived.');
        });
    }

    deleteHandler() {
        let self = this;

        const selector = '.detail-action.delete';
        $(document).off('click', selector).on('click', selector, event => {
            const threadId = DetailView.getEntityId();
            const card = new CardView(threadId);
            const detail = new DetailView(threadId);
            const columnId = detail.getColumnId();
            const boardId = detail.getBoardId();

            const successCallback = () => {
                self.detailService.delete(threadId, columnId, boardId);
                card.remove();
            };
            const failCallback = () => {
                card.show();
            };

            card.hide();
            detail.close();
            self.undoable(successCallback, failCallback, 'Conversation moved to Trash.');
        });
    }

    markAsUnreadHandler() {
        let self = this;

        const selector = '.detail-container .detail-action.mark-as-unread';
        $(document).off('click', selector).on('click', selector, async event => {
            const threadId = DetailView.getEntityId();
            const detail = new DetailView(threadId);
            const boardId = detail.getBoardId();
            const columnId = detail.getColumnId();
            const markAsRead = false;

            await self.detailService.markAsUnread(threadId, self.enums.ENTITY_TYPE.EMAIL, boardId, markAsRead, columnId);
            self.message.showButterBarLoader("Conversation marked as unread.", 2000);
            detail.close();
            new CardView(threadId).setRead(markAsRead);
        });
    }

    markAsStarHandler() {
        let self = this;

        const selector = '.detail-action.mark-as-star';
        $(document).off('click', selector).on('click', selector, async event => {
            const threadId = DetailView.getEntityId();
            const detail = new DetailView(threadId);
            const boardId = detail.getBoardId();
            const columnId = detail.getColumnId();

            let messageId = $(event.target).closest('.detail-email').attr('data-message-id');
            const markAsStar = $(event.target).text().trim() == 'star_border';
            await self.detailService.markMessageAsStar(messageId, threadId, boardId, markAsStar, columnId);
            detail.setEmailStar(messageId, markAsStar);
        });
    }

    async openInlineCompose(messageId, rfcMessageId, entityId, senderEmail, composeType) {
        const self = this;
        const detail = new DetailView(entityId);
        const boardId = detail.getBoardId();

        detail.loading();

        try {
            const { messageData, hasDraft, isDraftAvailable } = await self.detailService.getMessageData(messageId, entityId, boardId);
            if (hasDraft && !isDraftAvailable) {
                return detail.loaded();
            }

            await detail.showCompose(messageId, rfcMessageId, senderEmail, composeType);
            self.entityEmail.setComposeContent(messageData, hasDraft);

            const signatureData = await self.gmailAPI.getUserSignature(senderEmail);
            self.entityEmail.setComposeSignature(signatureData.signature);
        } catch(error) {
            throw new Error(`DetailEventHandler.openInlineCompose(${composeType}): \n${error}`);
        } finally {
            detail.loaded();
        }
    }

    replyHandler() {
        let self = this;

        const selector = 'li[data-value="reply"], .detail-container .detail-body .detail-email .detail-email-actions .detail-action.reply';
        $(document).off('click', selector).on('click', selector, async event => {
            const detailEmail = $(event.target).closest('.detail-email');
            const messageId = detailEmail.attr('data-message-id');
            const rfcMessageId = detailEmail.attr('data-rfc-message-id');
            const entityId = DetailView.getEntityId();
            const composeType = 'reply';
            let senderEmail = self.user.getUserEmailAddress();

            const selectedEmail = new DropdownView(`#reply-as-${messageId}`).getSelectedOption();
            if (!_.isEmpty(selectedEmail) && !_.isEmpty(selectedEmail.value)) {
                senderEmail = selectedEmail.value;
            }

            await self.openInlineCompose(messageId, rfcMessageId, entityId, senderEmail, composeType);
        });
    }
    showReplyAsSettingsPopup(boardId, boardName, loaderObj = null, defaultReplyAsEmail = null) {
        let self = this;
        let options = $('.reply-as .dropdown-option');
        let existingEmails = [];
        for (let i = 0; i < options.length; i++)
            existingEmails.push($(options[i]).attr('data-value'));
        self.teamBoard.listTeamBoardInvitation(boardId).then((members) => {
            let userEmail = self.user.getUserEmailAddress();
            let memberList = self.teamBoardEventHandler.getMemberList();
            // members = members.filter((member) => member.IsAuthorizedToSendEmail);
            // console.log(memberList);
            $('.confirm-popup, .popup').remove();

            if (loaderObj) {
                loaderObj.destroy();
            }

            let popupHtml = self.html.boardDefaultReplyAsPopup(userEmail, boardId, boardName, members, memberList, defaultReplyAsEmail);
            $('body').append(popupHtml);
        }).catch((err) => {
            self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
            console.log(err);
        });
    }
    openReplyAsPopup(event) {
        event.preventDefault();
        let self = this;
        const loaderObj = self.message.showButterBarLoader('Loading..');
        let boardId = self.teamBoardEventHandler.getBoardId(),
            boardName,
            defaultReplyAsEmail;
        _.forEach(self.teamBoard.getTeamBoardList(), (teamBoard) => {
            if (teamBoard.Id == boardId) {
                boardName = teamBoard.BoardName;
                defaultReplyAsEmail = teamBoard.ReplyAsEmail;
            }
        });
        self.showReplyAsSettingsPopup(boardId, boardName, loaderObj, defaultReplyAsEmail);
    }
    replyAsHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-email .detail-email-actions .detail-action.reply-as';
        $(document).off('onSelect', selector).on('onSelect', selector, async (event, data) => {
            const detailEmail = $(event.target).closest('.detail-email');
            const messageId = detailEmail.attr('data-message-id');
            const rfcMessageId = detailEmail.attr('data-rfc-message-id');
            const entityId = DetailView.getEntityId();
            const composeType = 'reply';
            const senderEmail = data.selected;
            if (senderEmail == 'setDefaulEmailAddress')
                self.openReplyAsPopup(event);
            else
                await self.openInlineCompose(messageId, rfcMessageId, entityId, senderEmail, composeType);
        });
    }

    replyAllHandler() {
        let self = this;

        const selector = 'li[data-value="reply-all"], .detail-container .detail-body .detail-actions .detail-action.reply-all';
        $(document).off('click', selector).on('click', selector, async event => {
            const detailEmail = $(event.target).closest('.detail-email');
            const messageId = detailEmail.attr('data-message-id');
            const rfcMessageId = detailEmail.attr('data-rfc-message-id');
            const entityId = DetailView.getEntityId();
            const composeType = 'reply-all';
            let senderEmail = self.user.getUserEmailAddress();

            const selectedEmail = new DropdownView(`#reply-as-${messageId}`).getSelectedOption();
            if (!_.isEmpty(selectedEmail) && !_.isEmpty(selectedEmail.value)) {
                senderEmail = selectedEmail.value;
            }

            await self.openInlineCompose(messageId, rfcMessageId, entityId, senderEmail, composeType);
        });
    }

    forwardHandler() {
        let self = this;

        const selector = 'li[data-value="forward"], .detail-container .detail-body .detail-email .detail-email-actions .detail-action.forward';
        $(document).off('click', selector).on('click', selector, async event => {
            const detailEmail = $(event.target).closest('.detail-email');
            const messageId = detailEmail.attr('data-message-id');
            const rfcMessageId = detailEmail.attr('data-rfc-message-id');
            const entityId = DetailView.getEntityId();
            const composeType = 'forward';
            const senderEmail = self.user.getUserEmailAddress();

            await self.openInlineCompose(messageId, rfcMessageId, entityId, senderEmail, composeType);
        });
    }

    addCommentHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-comments-container .detail-row-container textarea';
        $(document).off('keydown', selector).on('keydown', selector, event => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);

            if (event.keyCode == 13 && !event.shiftKey) {
                event.preventDefault();
                let comment = $(event.target).val().trim();
                let updateId = $(event.target).attr('data-update-id');

                if (comment == '' || self.formValidation.isHtmlTagsExist(comment)) {
                    self.message.showGmailErrorMessages('Please add a valid comment.');
                    return;
                }

                $(event.target).val('');
                $(event.target).attr('data-update-id', '');
                if (_.isEmpty(updateId)) {
                    updateId = undefined;
                }

                let mentionsMap = DetailView.getMentionsMap();
                self.detailService.saveComment(entityId, entityType, comment, mentionsMap, updateId).then(response => {
                    if (!response.Success) {
                        self.message.showGmailErrorMessages(response.Error);
                        return;
                    }

                    const detail = new DetailView(entityId);
                    if (updateId == undefined) {
                        detail.addComment(response.CommentDetails);
                        new CardView(entityId).setNumOfComments(response.CommentDetails.totalOfComments);
                    } else {
                        detail.updateComment(response.CommentDetails);
                    }
                }).catch(err => {
                    self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                    console.log(err);
                }).finally(() => {
                    DetailView.resetMentionsMap();
                });
            }
        });
    }

    updateCommentHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-comments-container .detail-comment.mine .detail-comment-action.edit';
        $(document).off('click', selector).on('click', selector, event => {
            const comment = $(event.target).closest('.detail-comment');
            const commentId = comment.data('id');
            const commentText = comment.find('.detail-comment-text').text().trim();

            $('.detail-container .detail-body .detail-comments-container .detail-row-container textarea').val(commentText).attr('data-update-id', commentId).focus();
        });
    }

    deleteCommentHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-comments-container .detail-comment.mine .detail-comment-action.delete';
        $(document).off('click', selector).on('click', selector, event => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);
            const comment = $(event.target).closest('.detail-comment');
            const commentId = comment.data('id');

            self.customUi.confirm('Are you sure you want to remove this comment?', 'Yes', 'Cancel', async (isConfirmed) => {
                if (!isConfirmed) {
                    return;
                }

                const { totalOfComments } = await self.detailService.deleteComment(entityId, entityType, commentId);
                new DetailView(entityId).removeComment(commentId);
                new CardView(entityId).setNumOfComments(totalOfComments);
            });
        });
    }

    addTaskHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-task-textarea';
        $(document).off('keydown', selector).on('keydown', selector, event => {
            if (event.keyCode == 13) {
                const entityId = DetailView.getEntityId();
                const entityType = self.enums.getEntityType(entityId);
                const detail = new DetailView(entityId);
                const boardId = detail.getBoardId();
                const card = new CardView(entityId);

                let checkListName = $(event.target).val().trim();
                let updateId = $(event.target).attr('data-update-id');

                if (checkListName == '') {
                    self.message.showGmailErrorMessages('Please add a valid task.');
                    return;
                }

                $(event.target).val('');
                $(event.target).attr('data-update-id', '');
                if (_.isEmpty(updateId)) {
                    self.detailService.addCheckListTask(entityId, entityType, boardId, checkListName)
                        .then((response) => {
                            detail.addTask(response);
                            self.dragTaskHandler();

                            card.addTask(response);
                            card.setTasksBadge(response.Total, response.Completed);
                        })
                        .catch((err) => {
                            self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                            console.log(err);
                        });
                    return;
                }

                const task = $(`.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-tasks .detail-task[data-task-id="${updateId}"`);
                const isCompleted = task.find('.detail-task-checkbox').is('[checked]');
                const position = task.attr('data-position');
                self.detailService.updateCheckListTaskText(entityId, entityType, boardId, updateId, checkListName, isCompleted)
                    .then((response) => {
                        const task = { CheckListId: updateId, CheckListName: checkListName, IsCompleted: isCompleted ? '1' : '0', Position: position };
                        detail.updateTask(task);
                        self.dragTaskHandler();
                        $('.detail-container').animate({ scrollTop: $(`.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-tasks .detail-task[data-task-id="${updateId}"`).offset().top - 50 }, 500);

                        card.updateTask(task);
                    })
                    .catch((err) => {
                        self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                        console.log(err);
                    });
            }
        });
    }

    updateTaskHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-tabs-container .detail-task .detail-task-action.edit';
        $(document).off('click', selector).on('click', selector, event => {
            const task = $(event.target).closest('.detail-task');
            const taskId = task.data('task-id');
            const taskText = task.find('.detail-task-text').text().trim();

            $('.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-task-textarea').val(taskText).attr('data-update-id', taskId).focus();
            $('.detail-container').animate({ scrollTop: $(`.detail-tabs-content .detail-task-textarea[data-update-id="${taskId}"]`).offset().top - 50 }, 500);
        });
    }

    deleteTaskHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-tabs-container .detail-task .detail-task-action.delete';
        $(document).off('click', selector).on('click', selector, event => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);

            const task = $(event.target).closest('.detail-task');
            const taskId = task.data('task-id');
            const taskText = task.find('.detail-task-text').text().trim();

            const detail = new DetailView(entityId);
            const boardId = detail.getBoardId();
            const card = new CardView(entityId);

            self.customUi.confirm('Are you sure you want to remove this task?', 'Yes', 'Cancel', async (isConfirmed) => {
                if (!isConfirmed) {
                    return;
                }

                try {
                    const response = await self.detailService.deleteCheckListTask(entityId, entityType, boardId, taskId, taskText);
                    detail.removeTask(taskId);
                    card.removeTask(taskId);
                    card.setTasksBadge(response.Total, response.Completed);
                } catch (error) {
                    self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                }
            });
        });
    }

    markTaskAsCompletedHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-tabs-container .detail-task .detail-task-checkbox';
        $(document).off('click', selector).on('click', selector, async event => {
            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);

            const task = $(event.target).closest('.detail-task');
            const taskId = task.data('task-id');
            const taskText = task.find('.detail-task-text').text().trim();
            const isCompleted = $(event.target).is('[checked]');

            const detail = new DetailView(entityId);
            const boardId = detail.getBoardId();
            const card = new CardView(entityId);

            try {
                detail.markTaskAsCompleted(taskId, isCompleted ? '0' : '1');
                card.markTaskAsCompleted(taskId, isCompleted ? '0' : '1');
                const response = await self.detailService.markCheckListTaskAsCompleted(entityId, entityType, boardId, taskId, taskText, !isCompleted);
                card.setTasksBadge(response.Total, response.Completed);
            } catch (error) {
                detail.markTaskAsCompleted(taskId, !isCompleted ? '0' : '1');
                card.markTaskAsCompleted(taskId, !isCompleted ? '0' : '1');
                self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
            }
        });
    }

    resizeTaskTextareaHandler() {
        let self = this;

        const selector = '.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-task-textarea';
        $(document).off('input', selector).on('input', selector, async event => {
            let element = event.target;
            if (element.scrollHeight > 60) {
                element.style.height = '5px';
                element.style.height = (element.scrollHeight + 10) + 'px';
            }
        });
    }

    dragTaskHandler() {
        const self = this;

        let oldIndex;
        const selector = '.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-tasks';
        $(selector).sortable({
            start: (event, ui) => {
                oldIndex = ui.item.index();
            },
            stop: async (event, ui) => {
                const index = ui.item.index();
                if (oldIndex == index) {
                    return;
                }

                const tasks = $(selector).find('.detail-task');
                const getPosition = (tasks, index) => {
                    return parseFloat($(tasks[index]).attr('data-position'));
                };

                let pos;
                if (index == 0) {
                    pos = getPosition(tasks, index + 1) + 1;
                } else if (index == tasks.length - 1) {
                    pos = getPosition(tasks, index - 1) - 1;
                } else {
                    pos = 0.5 * (getPosition(tasks, index - 1) + getPosition(tasks, index + 1));
                }

                const task = $(ui.item.context);
                const checkListId = task.attr('data-task-id');
                const entityId = DetailView.getEntityId();
                const entityType = self.enums.getEntityType(entityId);
                const boardId = new DetailView(entityId).getBoardId();

                await self.detailService.updateCheckListTaskPosition(checkListId, entityId, entityType, boardId, pos);
                task.attr('data-position', pos);
            }
        });
        $(selector).disableSelection();
    }

    updateNotesHandler() {
        let self = this;

        const editingClass = 'editing-notes';
        const textSelector = '.detail-container .detail-body .detail-tabs-container .detail-tabs-content .detail-notes textarea';
        $(document).off('keydown', textSelector).on('keydown', textSelector, event => {
            const detailContainer = $(event.target).closest('.detail-container');

            if (!detailContainer.hasClass(editingClass)) {
                detailContainer.addClass(editingClass);
            }
        });

        const saveSelector = `.detail-container.${editingClass}`;
        $(document).off('click', saveSelector).on('click', saveSelector, event => {
            if ($(event.target).closest('.detail-notes').length) {
                return;
            }

            const entityId = DetailView.getEntityId();
            const entityType = self.enums.getEntityType(entityId);
            const detail = new DetailView(entityId);
            const boardId = detail.getBoardId();
            const textarea = $(textSelector);
            const note = textarea.val().trim();
            let oldNote = textarea.closest('.detail-notes').attr('data-saved-note');
            oldNote = typeof oldNote === 'string' && oldNote.trim().length ? oldNote : '';

            self.detailService.updateNotes(entityId, entityType, boardId, note)
                .then(() => {
                    detail.setNote(note);
                    self.message.showMessage('Saved');
                    new CardView(entityId).setNote(note);
                    $(event.target).closest('.detail-container').removeClass(editingClass);
                })
                .catch((err) => {
                    detail.setNote(oldNote);
                    self.message.showGmailErrorMessages('Something went wrong. Please refresh page or try again later.');
                    console.log(err);
                });
        });
    }

    selectBoardHandler() {
        let self = this;

        const selector = '.detail-container .detail-header #detail-select-board';
        $(document).off('onSelect', selector).on('onSelect', selector, (event, data) => {
            const entityId = DetailView.getEntityId();
            const selectedBoardId = data.selected;
            const columns = self.detailService.getOrderedColumns(selectedBoardId);

            new DetailView(entityId).setColumns(columns, selectedBoardId);
        });
    }

    navigateToBoardHandler() {
        const selector = '[class$="navigateToBoard"]';
        $(document).off('click', selector).on('click', selector, event => {
            $('.drag-left-nav-icon-' + event.target.id.split(':')[1]).trigger('click');

            if ($('.detail-container').length > 0) {
                const entityId = DetailView.getEntityId();
                setTimeout(() => {
                    new DetailView(entityId).close();
                }, 1000);
            }
        });
    }

    navigateToCardHandler() {
        const self = this;

        const selector = '.navigateToCard, [class$="navigateToCard"]';
        $(document).off('click', selector).on('click', selector, event => {
            const [boardId, threadId] = event.target.id.split(':')[1].split('-');
            self.showDetail(threadId, boardId);
        });
    }

    refreshPositionHandler() {
        const appRenderer = dependencyInjector('AppRenderer');
        appRenderer.registerResizeCallback('DetailView.refreshPosition', event => {
            DetailView.refreshPosition(event);
            // to ensure the exact position, as the add-on bar transition can take some time
            for (let i = 0; i < 15; i++) {
                setTimeout(() => DetailView.refreshPosition(event), 50 * (i + 1));
            }
        });
    }
}


export default DetailEventHandler;
