var db = require.main.require('./utils/databases');
var logger = require.main.require('./utils/logger');

module.exports = {
    canViewForum: function (forumID, userData, callback)
    {
        var userGroups = [];
        if (userData !== null)
        {
            for (var i = 0; i < userData.groups.length; i++)
            {
                userGroups.push(userData.groups[i].group_id);
            }
        }
        else
            userGroups = 0;

        canViewBoard(forumID, userData, userGroups, function (response)
        {
            return callback(response);
        });
    }
};

function canViewBoard(forumID, userData, userGroups, callback)
{
    db.getForumConnection(function (err, connection)
    {
        var returnDirectory = [];
        var tempID;

        connection.query({
            sql: "SELECT * FROM forum_boards WHERE board_id = ?",
            timeout: 30000,
            values: [forumID]
        }, function (error, results)
        {
            connection.release();
            if (error)
            {
                logger.info(error);
                return callback(false);
            }
            else
            {
                tempID = results[0].board_id;
                var tempObj = {};
                tempObj[tempID] = results[0].board_title;
                returnDirectory.push(tempObj);

                // Success
                var mainBoard = results[0];
                var canViewResult = true;

                if (mainBoard['board_sub_board_to'] > 0)
                {
                    canViewBoard(mainBoard['board_sub_board_to'], userData, userGroups, function (response)
                    {
                        canViewResult = response;

/*                        if (userData !== null)
                        {
                            var birthDate = moment(userData.ssn.substr(0, 8), "YYYYMMDD");
                            var age = moment().diff(birthDate, 'years');
                        }
                        else
                        {
                            var age = 0;
                        }*/

                        if (canViewResult === false)
                        {
                            return callback(false);
                        }
/*                        else if (mainBoard['board_age_min'] > 0)
                        {
                            if (age >= mainBoard['board_age_min'])
                            {
                                returnDirectory = returnDirectory.concat(canViewResult);
                                return callback(returnDirectory);
                            }
                            else
                            {
                                return callback(false);
                            }
                        }*/
                        else if (mainBoard['board_user_groups_can_view'] == 0)
                        {
                            returnDirectory = returnDirectory.concat(canViewResult);

                            return callback(returnDirectory);
                        }
                        else
                        {
                            checkUserGroups(userGroups, mainBoard['board_user_groups_can_view'], function (response)
                            {
                                if (response == false)
                                    return callback(false);
                                else
                                    return callback(returnDirectory);
                            })
                        }
                    });
                }
                else
                {
/*                    if (userData !== null)
                    {
                        var birthDate = moment(userData.ssn.substr(0, 8), "YYYYMMDD");
                        var age = moment().diff(birthDate, 'years');
                    }
                    else
                    {
                        var age = 0;
                    }*/

                    if (canViewResult === false)
                    {
                        return callback(false);
                    }
/*                    else if (mainBoard['board_age_min'] > 0)
                    {
                        if (age >= mainBoard['board_age_min'])
                        {
                            returnDirectory = returnDirectory.concat(canViewResult);
                            return callback(returnDirectory);
                        }
                        else
                        {
                            return callback(false);
                        }
                    }*/
                    else if (mainBoard['board_user_groups_can_view'] == 0)
                    {
                        return callback(returnDirectory);
                    }
                    else
                    {
                        checkUserGroups(userGroups, mainBoard['board_user_groups_can_view'], function (response)
                        {
                            if (response == false)
                                return callback(false);
                            else
                                return callback(returnDirectory);
                        })
                    }
                }
            }
        });
    });
}

function checkUserGroups(userGroups, boardGroupsResponse, callback)
{
    var canViewTemp = false;
    boardGroupsResponse = boardGroupsResponse.slice(1, -1);
    var boardGroups = boardGroupsResponse.split("-");
    for (var i = 0; i < userGroups.length; i++)
    {
        for (var j = 0; j < boardGroups.length; j++)
        {
            if (userGroups[i] == boardGroups[j])
                canViewTemp = true;
        }
    }
    if (canViewTemp === false)
    {
        return callback(false);
    }
    else
    {
        return callback(true);
    }
}